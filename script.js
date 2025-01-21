import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } from 'https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js';

// Konfiguracja Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD7n_SKELZwBeInygjo7pgdHPEaLttEP14",
    authDomain: "stawy1-17e50.firebaseapp.com",
    projectId: "stawy1-17e50",
    storageBucket: "stawy1-17e50.appspot.com",
    messagingSenderId: "366912355442",
    appId: "1:366912355442:web:b56a8c10f96db783ea16eb",
    measurementId: "G-LVDE79M9K1"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elementy DOM
const mapElement = document.getElementById('map');
const addPinButton = document.getElementById('add-pin-btn');
const deletePinButton = document.getElementById('delete-pin-btn');
const adminPanelBtn = document.getElementById('admin-panel-btn');
const closeAdminPanel = document.getElementById('close-admin-panel');
const adminPanel = document.getElementById('admin-panel');

let addingPin = false;
let deletingPin = false;
let isAdminPanelVisible = false;
let pins = [];
let selectedPin = null;

// Funkcja do przełączania panelu administratora
function toggleAdminPanel() {
    if (isAdminPanelVisible) {
        adminPanel.style.display = 'none';
    } else {
        adminPanel.style.display = 'block';
    }
    isAdminPanelVisible = !isAdminPanelVisible;
}

// Funkcja tworzenia pinezki
function createPin(x, y, name = "Nowa Pinezka", removable = true, occupied = false, endTime = null, lastRefresh = null) {
    const pin = document.createElement('div');
    pin.classList.add('pin');
    pin.style.left = `${x}%`;
    pin.style.top = `${y}%`;
    pin.title = name;

    const infoBox = document.createElement('div');
    infoBox.classList.add('info-box');
    infoBox.innerHTML = `
        <div class="pin-name"><strong>Stanowisko:</strong> ${name}</div>
        <label>
            <input type="checkbox" id="occupied" ${occupied ? 'checked' : ''}> Zajęte
        </label>
        <br>
        <label>
            Do której godziny: <input type="time" id="end-time" value="${endTime || ''}">
        </label>
        <br>
        <button class="refresh-btn">Odśwież stanowisko</button>
        <button class="release-btn">Zwolnij stanowisko</button>
        <div>Ostatnie odświeżenie: <span class="last-refresh">${lastRefresh || 'Brak'}</span></div>
    `;

    pin.addEventListener('click', (event) => {
        if (deletingPin) {
            if (removable) {
                // Jeśli pinezka jest usuwalna, usuń ją bez hasła
                if (confirm(`Czy na pewno chcesz usunąć pinezkę: ${name}?`)) {
                    mapElement.removeChild(pin);
                    pins = pins.filter(p => p.element !== pin);
                    deletePinFromDatabase(name);  // Usuń pinezkę z bazy danych
                }
            } else {
                alert("Pinezka jest zablokowana przez Administratora")
            }
        } else {
            event.stopPropagation();
            closeAllInfoBoxes();
            infoBox.classList.add('active');
        }
    });
    
        

    infoBox.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent click from closing the box
    });

    pin.appendChild(infoBox);
    mapElement.appendChild(pin);
    pins.push({ x, y, name, removable, element: pin });

    // Dodanie nasłuchiwaczy zdarzeń do checkboxa, endTime i przycisków
    const occupiedCheckbox = infoBox.querySelector('#occupied');
    occupiedCheckbox.addEventListener('change', (event) => toggleOccupied(event.target));

    const endTimeInput = infoBox.querySelector('#end-time');
    endTimeInput.addEventListener('change', (event) => updateEndTime(event.target));

    const refreshButton = infoBox.querySelector('.refresh-btn');
    refreshButton.addEventListener('click', (event) => refreshSpot(event.target));

    const releaseButton = infoBox.querySelector('.release-btn');
    releaseButton.addEventListener('click', (event) => releaseSpot(event.target));
}

// Funkcja zapisu pinezki do bazy danych Firestore
async function savePinToDatabase(x, y, name, removable) {
    try {
        // Przeszukaj bazę danych, aby sprawdzić, czy pinezka o tych samych współrzędnych już istnieje
        const q = query(collection(db, "pins"), where("x", "==", x), where("y", "==", y));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            console.log("Pinezka już istnieje w bazie danych");
            return;  // Pinezka już istnieje, więc nie zapisujemy jej ponownie
        }

        // Dodajemy pinezkę do bazy, jeśli jej tam jeszcze nie ma
        await addDoc(collection(db, "pins"), {
            x: x,
            y: y,
            name: name,
            removable: removable,
            occupied: false,
            endTime: null,
            lastRefresh: null
        });
        console.log("Pinezka została zapisana w Firestore");
    } catch (error) {
        console.error("Błąd podczas zapisywania pinezki: ", error);
    }
}

// Funkcja usuwania pinezki z bazy danych Firestore
async function deletePinFromDatabase(name) {
    try {
        const querySnapshot = await getDocs(collection(db, "pins"));
        querySnapshot.forEach(async (docSnapshot) => {
            const pinData = docSnapshot.data();
            if (pinData.name === name) {
                await deleteDoc(doc(db, "pins", docSnapshot.id));
                console.log("Pinezka została usunięta z Firestore");
            }
        });
    } catch (error) {
        console.error("Błąd podczas usuwania pinezki z Firestore: ", error);
    }
}

// Funkcja do ładowania pinezek z Firestore
async function loadPinsFromDatabase() {
    try {
        const querySnapshot = await getDocs(collection(db, "pins"));
        if (querySnapshot.empty) {
            console.log("Brak pinezek w bazie danych");
        } else {
            querySnapshot.forEach((doc) => {
                const pinData = doc.data();
                console.log("Załadowana pinezka: ", pinData);
                createPin(pinData.x, pinData.y, pinData.name, pinData.removable, pinData.occupied, pinData.endTime, pinData.lastRefresh);
            });
        }
    } catch (error) {
        console.error("Błąd podczas ładowania pinezek z Firestore: ", error);
    }
}

// Funkcje do zarządzania stanem pinezki
function toggleOccupied(checkbox) {
    const infoBox = checkbox.closest('.info-box');
    const pinName = infoBox.parentElement.title; // Pobranie nazwy pinezki
    const isOccupied = checkbox.checked;
    updatePinInDatabase({ name: pinName }, { occupied: isOccupied });
}

function updateEndTime(input) {
    const infoBox = input.closest('.info-box');
    const pinName = infoBox.parentElement.title; // Pobranie nazwy pinezki
    const endTime = input.value; // Pobranie wartości z inputa
    updatePinInDatabase({ name: pinName }, { endTime: endTime });
}

function refreshSpot(button) {
    const infoBox = button.parentElement;
    updateLastRefresh(infoBox);
    alert("Stanowisko zostało odświeżone.");
    const pinName = infoBox.parentElement.title;
    const updatedLastRefresh = new Date().toLocaleString();
    updatePinInDatabase({ name: pinName }, { lastRefresh: updatedLastRefresh });
}

function releaseSpot(button) {
    const infoBox = button.parentElement;
    const isOccupied = infoBox.querySelector('#occupied');
    if (isOccupied.checked) {
        isOccupied.checked = false;
        alert("Stanowisko zostało zwolnione.");
    } else {
        alert("Stanowisko jest już wolne.");
    }
    updateLastRefresh(infoBox);
}

function updateLastRefresh(infoBox) {
    const lastRefresh = infoBox.querySelector('.last-refresh');
    const currentTime = new Date().toLocaleString();
    lastRefresh.textContent = currentTime;
}

// Funkcja aktualizująca dane pinezki w Firestore
async function updatePinInDatabase(pin, updatedData) {
    try {
        const pinRef = query(collection(db, "pins"), where("name", "==", pin.name));
        const querySnapshot = await getDocs(pinRef);
        if (!querySnapshot.empty) {
            const docSnapshot = querySnapshot.docs[0];
            await updateDoc(doc(db, "pins", docSnapshot.id), updatedData);
            console.log("Pinezka została zaktualizowana w Firestore");
        }
    } catch (error) {
        console.error("Błąd podczas aktualizacji pinezki: ", error);
    }
}

// Funkcja do zamykania wszystkich okienek informacyjnych
function closeAllInfoBoxes() {
    const infoBoxes = document.querySelectorAll('.info-box');
    infoBoxes.forEach(box => box.classList.remove('active'));
}

// Funkcja do rozpoczynania dodawania pinezki
function startAddingPin() {
    addingPin = true;
    alert("Kliknij na mapę, aby dodać pinezkę.");
    mapElement.addEventListener('click', addPinOnMap);
}

// Funkcja do kończenia dodawania pinezki
function stopAddingPin() {
    addingPin = false;
    alert("Dodawanie pinezek zakończone.");
    mapElement.removeEventListener('click', addPinOnMap);
}

// Funkcja do dodawania pinezki na mapie
function addPinOnMap(event) {
    if (addingPin) {
        const rect = mapElement.getBoundingClientRect(); // Pozyskujemy wymiary mapy w stosunku do okna
        const x = (event.offsetX / mapElement.offsetWidth) * 100;
        const y = (event.offsetY / mapElement.offsetHeight) * 100;

        // Dodajemy prompt do wprowadzenia nazwy pinezki
        const pinName = prompt("Wprowadź nazwę pinezki:", "Nowa Pinezka");

        if (pinName && pinName.trim() !== "") {
            createPin(x, y, pinName);  // Tworzymy pinezkę na mapie
            savePinToDatabase(x, y, pinName, true);  // Zapisujemy do bazy danych
        } else {
            alert("Musisz podać nazwę pinezki.");
        }

        stopAddingPin();
    }
}


// Nasłuchiwanie zdarzeń
addPinButton.addEventListener('click', startAddingPin);
deletePinButton.addEventListener('click', () => {
    alert('Proszę wybrać pinezkę do usunięcia');
    deletingPin = !deletingPin; // Przełącz tryb usuwania pinezki
});

adminPanelBtn.addEventListener('click', toggleAdminPanel);
closeAdminPanel.addEventListener('click', toggleAdminPanel);

// Ładowanie pinezek z bazy danych po załadowaniu strony
window.addEventListener('load', loadPinsFromDatabase);

// Nasłuchiwanie kliknięcia poza infoBox
document.addEventListener('click', (event) => {
    const infoBox = event.target.closest('.info-box');
    if (!infoBox) {
        closeAllInfoBoxes();
    }
});
