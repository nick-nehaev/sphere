// Глобальные переменные
let sessions = [];
let currentSession = null;
let selectedSeats = [];
let reservationTimer = null;
let currentReservationId = null;

// Константы для зала
const ROWS = 10;
const SEATS_PER_ROW = 10;

// Категории мест и цены
const SEAT_CATEGORIES = {
    economy: { name: 'Эконом', basePrice: 200 },
    standard: { name: 'Стандарт', basePrice: 350 },
    premium: { name: 'Премиум', basePrice: 500 }
};

// Определение категории места
function getSeatCategory(row, seat) {
    // Ряд 1 - эконом
    if (row === 1) return 'economy';

    // Места 4,5,6,7 в рядах 4,5,6 - премиум
    if ([4, 5, 6].includes(row) && [4, 5, 6, 7].includes(seat)) {
        return 'premium';
    }

    // Все остальные - стандарт
    return 'standard';
}

// Генерация тестовых данных
function generateTestSessions() {
    const movies = [
        {
            title: 'Интерстеллар',
            genres: ['Фантастика', 'Драма'],
            poster: 'https://via.placeholder.com/300x400/667eea/ffffff?text=Интерстеллар',
            description: 'Когда засуха приводит человечество к продовольственному кризису, коллектив исследователей и учёных отправляется сквозь червоточину в путешествие, чтобы превзойти прежние ограничения для космических путешествий человека и найти планету с подходящими для человечества условиями.'
        },
        {
            title: 'Начало',
            genres: ['Фантастика', 'Боевик', 'Триллер'],
            poster: 'https://via.placeholder.com/300x400/764ba2/ffffff?text=Начало',
            description: 'Кобб — талантливый вор, лучший из лучших в опасном искусстве извлечения: он крадёт ценные секреты из глубин подсознания во время сна, когда человеческий разум наиболее уязвим.'
        },
        {
            title: 'Матрица',
            genres: ['Фантастика', 'Боевик'],
            poster: 'https://via.placeholder.com/300x400/48c774/ffffff?text=Матрица',
            description: 'Жизнь Томаса Андерсона разделена на две части: днём он — самый обычный офисный работник, получающий нагоняи от начальства, а ночью превращается в хакера по имени Нео.'
        },
        {
            title: 'Темный рыцарь',
            genres: ['Боевик', 'Триллер', 'Криминал'],
            poster: 'https://via.placeholder.com/300x400/3273dc/ffffff?text=Темный+рыцарь',
            description: 'Бэтмен поднимает ставки в войне с криминалом. С помощью лейтенанта Джима Гордона и прокурора Харви Дента он намерен очистить улицы от преступности.'
        },
        {
            title: 'Побег из Шоушенка',
            genres: ['Драма'],
            poster: 'https://via.placeholder.com/300x400/ffdd57/333333?text=Побег+из+Шоушенка',
            description: 'Бухгалтер Энди Дюфрейн обвинён в убийстве собственной жены и её любовника. Оказавшись в тюрьме под названием Шоушенк, он сталкивается с жестокостью и беззаконием, царящими по обе стороны решётки.'
        },
        {
            title: 'Форрест Гамп',
            genres: ['Драма', 'Комедия'],
            poster: 'https://via.placeholder.com/300x400/f14668/ffffff?text=Форрест+Гамп',
            description: 'Форрест Гамп — не самый умный человек на свете, но он знает, что такое любовь, и его доброта и оптимизм помогают ему преодолеть все трудности.'
        }
    ];

    const today = new Date();
    const generatedSessions = [];

    // Генерируем сеансы на неделю
    for (let day = 0; day < 7; day++) {
        const date = new Date(today);
        date.setDate(date.getDate() + day);
        const dateStr = date.toISOString().split('T')[0];

        // Для каждого дня создаем несколько сеансов
        movies.forEach((movie, idx) => {
            const times = ['10:00', '13:30', '17:00', '20:30'];
            const time = times[idx % times.length];

            generatedSessions.push({
                id: `session_${day}_${idx}`,
                movieTitle: movie.title,
                genres: movie.genres,
                poster: movie.poster,
                description: movie.description,
                date: dateStr,
                time: time,
                availableSeats: ROWS * SEATS_PER_ROW,
                priceRange: {
                    min: SEAT_CATEGORIES.economy.basePrice,
                    max: SEAT_CATEGORIES.premium.basePrice
                }
            });
        });
    }

    return generatedSessions;
}

// Инициализация приложения
async function initApp() {
    try {
        // Проверяем, есть ли сеансы в Firestore
        const sessionsSnapshot = await db.collection('sessions').get();

        if (sessionsSnapshot.empty) {
            // Если нет, создаем тестовые данные
            const testSessions = generateTestSessions();
            for (const session of testSessions) {
                await db.collection('sessions').doc(session.id).set(session);
            }
        }

        // Загружаем сеансы
        await loadSessions();

        // Заполняем фильтры
        populateFilters();

        // Отображаем сеансы
        displaySessions();

        // Подписываемся на изменения
        subscribeToSessionUpdates();

        console.log('Приложение инициализировано');
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    }
}

// Загрузка сеансов из Firestore
async function loadSessions() {
    const snapshot = await db.collection('sessions').get();
    sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Подписка на обновления сеансов
function subscribeToSessionUpdates() {
    db.collection('sessions').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'modified') {
                const updatedSession = { id: change.doc.id, ...change.doc.data() };
                const index = sessions.findIndex(s => s.id === updatedSession.id);
                if (index !== -1) {
                    sessions[index] = updatedSession;
                }

                // Если это текущий открытый сеанс, обновляем зал
                if (currentSession && currentSession.id === updatedSession.id) {
                    currentSession = updatedSession;
                    renderCinemaHall();
                }
            }
        });

        displaySessions();
    });
}

// Заполнение фильтров
function populateFilters() {
    const dateFilter = document.getElementById('filter-date');
    const genreFilter = document.getElementById('filter-genre');

    // Уникальные даты
    const dates = [...new Set(sessions.map(s => s.date))].sort();
    dates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        const dateObj = new Date(date);
        option.textContent = dateObj.toLocaleDateString('ru-RU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
        dateFilter.appendChild(option);
    });

    // Уникальные жанры
    const genres = [...new Set(sessions.flatMap(s => s.genres))].sort();
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreFilter.appendChild(option);
    });
}

// Отображение сеансов
function displaySessions() {
    const container = document.getElementById('sessions-list');
    const titleFilter = document.getElementById('filter-title').value.toLowerCase();
    const dateFilter = document.getElementById('filter-date').value;
    const genreFilter = document.getElementById('filter-genre').value;
    const priceMin = parseInt(document.getElementById('filter-price-min').value);
    const priceMax = parseInt(document.getElementById('filter-price-max').value);

    const filtered = sessions.filter(session => {
        const matchTitle = session.movieTitle.toLowerCase().includes(titleFilter);
        const matchDate = !dateFilter || session.date === dateFilter;
        const matchGenre = !genreFilter || session.genres.includes(genreFilter);
        const matchPrice = session.priceRange.min <= priceMax && session.priceRange.max >= priceMin;

        return matchTitle && matchDate && matchGenre && matchPrice;
    });

    container.innerHTML = filtered.map(session => `
        <div class="session-card" onclick="openSession('${session.id}')">
            <img src="${session.poster}" alt="${session.movieTitle}">
            <div class="session-card-content">
                <h3>${session.movieTitle}</h3>
                <div class="session-genres">
                    ${session.genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}
                </div>
                <div class="session-card-details">
                    <p>📅 ${new Date(session.date).toLocaleDateString('ru-RU')} в ${session.time}</p>
                    <p>🎫 Мест: ${session.availableSeats} / ${ROWS * SEATS_PER_ROW}</p>
                    <p>💰 ${session.priceRange.min} - ${session.priceRange.max} ₽</p>
                </div>
            </div>
        </div>
    `).join('');
}

// Открытие страницы сеанса
async function openSession(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    currentSession = session;
    selectedSeats = [];

    document.getElementById('main-page').classList.remove('active');
    document.getElementById('session-page').classList.add('active');

    document.getElementById('session-title').textContent = session.movieTitle;
    document.getElementById('session-poster').src = session.poster;
    document.getElementById('session-details').innerHTML = `
        <h3>${session.movieTitle}</h3>
        <p>${session.description}</p>
        <p><strong>Жанры:</strong> ${session.genres.join(', ')}</p>
        <p><strong>Дата и время:</strong> ${new Date(session.date).toLocaleDateString('ru-RU')} в ${session.time}</p>
    `;

    renderCinemaHall();
    updateOrderPanel();
}

// Отрисовка зала
function renderCinemaHall() {
    const hall = document.getElementById('cinema-hall');
    const categoryFilters = Array.from(document.querySelectorAll('.category-filter:checked')).map(cb => cb.value);

    hall.innerHTML = '';

    for (let row = 1; row <= ROWS; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row';

        const rowNumber = document.createElement('div');
        rowNumber.className = 'row-number';
        rowNumber.textContent = row;
        rowDiv.appendChild(rowNumber);

        for (let seat = 1; seat <= SEATS_PER_ROW; seat++) {
            const seatDiv = document.createElement('div');
            const category = getSeatCategory(row, seat);
            const seatId = `${row}-${seat}`;

            seatDiv.className = `seat ${category}`;
            seatDiv.dataset.row = row;
            seatDiv.dataset.seat = seat;
            seatDiv.dataset.category = category;

            // Проверяем статус места
            const seatStatus = getSeatStatus(seatId);

            if (seatStatus === 'purchased') {
                seatDiv.classList.add('purchased');
            } else if (seatStatus === 'reserved') {
                seatDiv.classList.add('reserved');
            } else if (selectedSeats.some(s => s.id === seatId)) {
                seatDiv.classList.add('selected');
            } else {
                seatDiv.classList.add('available');
            }

            // Применяем фильтр категорий
            if (!categoryFilters.includes(category)) {
                seatDiv.classList.add('hidden');
            }

            seatDiv.addEventListener('click', () => toggleSeat(row, seat, category));

            rowDiv.appendChild(seatDiv);
        }

        hall.appendChild(rowDiv);
    }
}

// Получение статуса места
function getSeatStatus(seatId) {
    if (!currentSession.seats) return 'available';

    const seat = currentSession.seats[seatId];
    if (!seat) return 'available';

    return seat.status || 'available';
}

// Переключение выбора места
function toggleSeat(row, seat, category) {
    const seatId = `${row}-${seat}`;
    const status = getSeatStatus(seatId);

    if (status === 'purchased' || status === 'reserved') {
        return; // Нельзя выбрать купленное или забронированное место
    }

    const index = selectedSeats.findIndex(s => s.id === seatId);

    if (index > -1) {
        // Снимаем выбор
        selectedSeats.splice(index, 1);
    } else {
        // Добавляем выбор
        selectedSeats.push({
            id: seatId,
            row,
            seat,
            category,
            price: SEAT_CATEGORIES[category].basePrice
        });
    }

    renderCinemaHall();
    updateOrderPanel();
}

// Обновление панели заказа
function updateOrderPanel() {
    const count = selectedSeats.length;
    const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);

    document.getElementById('selected-count').textContent = count;
    document.getElementById('total-price').textContent = total;
    document.getElementById('book-btn').disabled = count === 0;
}

// Бронирование мест
async function bookSeats() {
    if (selectedSeats.length === 0) return;

    try {
        // Создаем бронь
        const reservationId = `res_${Date.now()}`;
        currentReservationId = reservationId;

        const seatUpdates = {};
        selectedSeats.forEach(seat => {
            seatUpdates[`seats.${seat.id}`] = {
                status: 'reserved',
                reservationId: reservationId,
                timestamp: Date.now()
            };
        });

        await db.collection('sessions').doc(currentSession.id).update(seatUpdates);

        // Открываем окно оплаты
        openPaymentModal();

    } catch (error) {
        console.error('Ошибка бронирования:', error);
        alert('Ошибка при бронировании мест');
    }
}

// Открытие окна оплаты
function openPaymentModal() {
    const modal = document.getElementById('payment-modal');
    modal.classList.add('active');

    const seats = selectedSeats.map(s => `Ряд ${s.row}, Место ${s.seat}`).join(', ');
    const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);

    document.getElementById('payment-seats').textContent = seats;
    document.getElementById('payment-total').textContent = total;

    // Скрываем успешную оплату
    document.getElementById('payment-success').classList.add('hidden');
    document.querySelector('.payment-details').classList.remove('hidden');
    document.querySelector('.payment-buttons').classList.remove('hidden');

    // Запускаем таймер
    startReservationTimer();
}

// Таймер брони
function startReservationTimer() {
    let timeLeft = 180; // 3 минуты в секундах
    const timerElement = document.getElementById('timer');

    clearInterval(reservationTimer);

    reservationTimer = setInterval(async () => {
        timeLeft--;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(reservationTimer);
            await cancelReservation();
            closePaymentModal();
            alert('Время брони истекло. Места освобождены.');
        }
    }, 1000);
}

// Оплата
async function payForSeats() {
    try {
        clearInterval(reservationTimer);

        const seatUpdates = {};
        selectedSeats.forEach(seat => {
            seatUpdates[`seats.${seat.id}`] = {
                status: 'purchased',
                timestamp: Date.now()
            };
        });

        await db.collection('sessions').doc(currentSession.id).update(seatUpdates);

        // Обновляем доступные места
        const availableSeats = currentSession.availableSeats - selectedSeats.length;
        await db.collection('sessions').doc(currentSession.id).update({ availableSeats });

        // Показываем успешную оплату
        document.querySelector('.payment-details').classList.add('hidden');
        document.querySelector('.payment-buttons').classList.add('hidden');
        document.getElementById('payment-success').classList.remove('hidden');

        selectedSeats = [];

    } catch (error) {
        console.error('Ошибка оплаты:', error);
        alert('Ошибка при оплате');
    }
}

// Отмена брони
async function cancelReservation() {
    if (!currentReservationId) return;

    try {
        const seatUpdates = {};
        selectedSeats.forEach(seat => {
            seatUpdates[`seats.${seat.id}`] = firebase.firestore.FieldValue.delete();
        });

        await db.collection('sessions').doc(currentSession.id).update(seatUpdates);

    } catch (error) {
        console.error('Ошибка отмены брони:', error);
    }
}

// Закрытие окна оплаты
function closePaymentModal() {
    clearInterval(reservationTimer);
    document.getElementById('payment-modal').classList.remove('active');
    renderCinemaHall();
    updateOrderPanel();
}

// Сброс купленных мест (девопс функция)
async function resetPurchasedSeats() {
    if (!confirm('Сбросить все купленные места?')) return;

    try {
        const snapshot = await db.collection('sessions').get();

        for (const doc of snapshot.docs) {
            const session = doc.data();
            if (!session.seats) continue;

            const updates = {};
            let purchasedCount = 0;

            Object.keys(session.seats).forEach(seatId => {
                if (session.seats[seatId].status === 'purchased') {
                    updates[`seats.${seatId}`] = firebase.firestore.FieldValue.delete();
                    purchasedCount++;
                }
            });

            if (Object.keys(updates).length > 0) {
                await db.collection('sessions').doc(doc.id).update(updates);
                await db.collection('sessions').doc(doc.id).update({
                    availableSeats: (session.availableSeats || 0) + purchasedCount
                });
            }
        }

        alert('Купленные места сброшены');

    } catch (error) {
        console.error('Ошибка сброса:', error);
        alert('Ошибка при сбросе мест');
    }
}

// Обработчики событий
document.addEventListener('DOMContentLoaded', () => {
    // Ждем загрузки Firebase
    setTimeout(() => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            initApp();
        } else {
            console.error('Firebase не загружен. Проверьте конфигурацию.');
        }
    }, 1000);

    // Фильтры
    document.getElementById('filter-title').addEventListener('input', displaySessions);
    document.getElementById('filter-date').addEventListener('change', displaySessions);
    document.getElementById('filter-genre').addEventListener('change', displaySessions);

    const priceMinInput = document.getElementById('filter-price-min');
    const priceMaxInput = document.getElementById('filter-price-max');

    priceMinInput.addEventListener('input', (e) => {
        document.getElementById('price-min-label').textContent = e.target.value;
        displaySessions();
    });

    priceMaxInput.addEventListener('input', (e) => {
        document.getElementById('price-max-label').textContent = e.target.value;
        displaySessions();
    });

    // Кнопка назад
    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('session-page').classList.remove('active');
        document.getElementById('main-page').classList.add('active');
        currentSession = null;
        selectedSeats = [];
    });

    // Фильтр категорий мест
    document.querySelectorAll('.category-filter').forEach(checkbox => {
        checkbox.addEventListener('change', renderCinemaHall);
    });

    // Бронирование
    document.getElementById('book-btn').addEventListener('click', bookSeats);

    // Оплата
    document.getElementById('pay-btn').addEventListener('click', payForSeats);

    // Отмена оплаты
    document.getElementById('cancel-payment-btn').addEventListener('click', closePaymentModal);

    // Закрытие успешной оплаты
    document.getElementById('close-success-btn').addEventListener('click', () => {
        closePaymentModal();
        document.getElementById('session-page').classList.remove('active');
        document.getElementById('main-page').classList.add('active');
    });

    // Сброс купленных мест
    document.getElementById('reset-purchased-btn').addEventListener('click', resetPurchasedSeats);
});
