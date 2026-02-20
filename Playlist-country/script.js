const dataBody = document.getElementById('data-body');
const speedInput = document.getElementById('speed');
const pauseInput = document.getElementById('pause');
const stopButton = document.getElementById('stopScroll');
const resumeButton = document.getElementById('resumeScroll');
const fullscreenWarning = document.getElementById('fullscreenWarning');

let scrollSpeed = 50; // intervallo in ms
let direction = 1;
let scrollInterval;
let pauseTime = 2000; // in ms
let isScrolling = true;

// Aggiorna velocità
speedInput.addEventListener('input', () => {
    const value = parseInt(speedInput.value);
    scrollSpeed = 300 / value; // più alto = più veloce
    if (isScrolling) restartScrolling();
});

// Aggiorna pausa
pauseInput.addEventListener('input', () => {
    pauseTime = parseInt(pauseInput.value) * 1000; // converti in ms
});

// Ferma lo scroll
stopButton.addEventListener('click', () => {
    isScrolling = false;
    clearInterval(scrollInterval);
});

// Riprendi lo scroll
resumeButton.addEventListener('click', () => {
    if (!isScrolling) {
        isScrolling = true;
        startScrolling();
    }
});

// Funzione fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// Apertura automatica fullscreen al caricamento
document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.requestFullscreen().catch(err => {
        fullscreenWarning.style.display = 'block'; // Mostra avviso se non consentito
        console.warn("Fullscreen non disponibile:", err);
    });
});

// Carica dati dal CSV
fetch('display.csv')
    .then(response => response.text())
    .then(text => {
        const rows = text.trim().split('\n').slice(3); // Skip first 3 lines
        rows.forEach(row => {
            const cols = row.split(',');
            const tr = document.createElement('tr');
            if (cols[0].trim().startsWith('X')) {
                tr.classList.add('orange-row');
            }
            cols.forEach(col => {
                const td = document.createElement('td');
                td.textContent = col.trim();
                tr.appendChild(td);
            });
            dataBody.appendChild(tr);
        });
        startScrolling();
    });

function startScrolling() {
    if (!isScrolling) return;
    const container = document.querySelector('.scroll-container');
    let scrollPos = container.scrollTop;
    scrollInterval = setInterval(() => {
        scrollPos += direction;
        container.scrollTop = scrollPos;
        if (scrollPos + container.clientHeight >= container.scrollHeight) {
            clearInterval(scrollInterval);
            setTimeout(() => {
                if (isScrolling) {
                    direction = -1;
                    startScrolling();
                }
            }, pauseTime);
        } else if (scrollPos <= 0) {
            clearInterval(scrollInterval);
            setTimeout(() => {
                if (isScrolling) {
                    direction = 1;
                    startScrolling();
                }
            }, pauseTime);
        }
    }, scrollSpeed);
}

function restartScrolling() {
    clearInterval(scrollInterval);
    startScrolling();
}
