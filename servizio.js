<script>
fetch('servizio.csv')
    .then(response => {
        if (!response.ok) {
            throw new Error('Errore nel caricamento del CSV');
        }
        return response.text();
    })
    .then(text => {
        const righe = text.trim().split('\n');
        const intestazioni = righe.shift().split(';');

        const thead = document.querySelector('#tabella thead');
        const tbody = document.querySelector('#tabella tbody');

        // intestazioni
        let trHead = '<tr>';
        intestazioni.forEach(h => trHead += `<th>${h}</th>`);
        trHead += '</tr>';
        thead.innerHTML = trHead;

        // dati
        righe.forEach(riga => {
            const celle = riga.split(';');
            let tr = '<tr>';
            celle.forEach(c => tr += `<td>${c}</td>`);
            tr += '</tr>';
            tbody.innerHTML += tr;
        });
    })
    .catch(error => {
        console.error(error);
        alert('Errore nel caricamento dei dati');
    });
</script>
