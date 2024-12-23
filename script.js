const API_KEY = 'AIzaSyD00fZSXDsQBx60juOZxBdgT--jQKVvpl0';

document.addEventListener('DOMContentLoaded', () => {
    const uploadBtn = document.getElementById('uploadBtn');
    const captureBtn = document.getElementById('captureBtn');
    const fileInput = document.getElementById('fileInput');
    const camera = document.getElementById('camera');
    const preview = document.getElementById('preview');
    const imagePreview = document.getElementById('imagePreview');
    const resultTable = document.getElementById('resultTable');

    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', handleImageUpload);
    captureBtn.addEventListener('click', startCamera);

    // Fonction de sanitisation des données
    function sanitizeData(data) {
        const clean = {};
        for (let key in data) {
            clean[key] = typeof data[key] === 'string' 
                ? data[key].replace(/[<>]/g, '') 
                : data[key];
        }
        return clean;
    }

    // Gestion de l'upload d'image
    async function handleImageUpload(e) {
        try {
            const file = e.target.files[0];
            if (file) {
                const imageUrl = URL.createObjectURL(file);
                preview.src = imageUrl;
                imagePreview.hidden = false;
                await analyzeMedication(file);
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert(error.message);
        }
    }

    // Gestion de la caméra
    async function startCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: { exact: "environment" },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };

            const fallbackConstraints = {
                video: {
                    facingMode: "user",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };

            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                camera.srcObject = stream;
                camera.hidden = false;
                await camera.play();
            } catch (err) {
                console.log("Caméra arrière non disponible, utilisation de la caméra frontale");
                const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                camera.srcObject = stream;
                camera.hidden = false;
                await camera.play();
            }

            camera.addEventListener('loadeddata', () => {
                const canvas = document.createElement('canvas');
                canvas.width = camera.videoWidth;
                canvas.height = camera.videoHeight;
                canvas.getContext('2d').drawImage(camera, 0, 0);
                
                canvas.toBlob(async (blob) => {
                    camera.hidden = true;
                    preview.src = URL.createObjectURL(blob);
                    imagePreview.hidden = false;
                    
                    const stream = camera.srcObject;
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                    
                    await analyzeMedication(blob);
                }, 'image/jpeg', 0.95);
            });

        } catch (err) {
            console.error('Erreur lors de l\'accès à la caméra:', err);
            alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
        }
    }

    // Analyse du médicament
    async function analyzeMedication(imageFile) {
        try {
            const scanStatus = document.getElementById('scanStatus');
            const statusMessage = document.getElementById('statusMessage');
            const generalInfo = document.getElementById('generalInfo');
            const medicalInfo = document.getElementById('medicalInfo');
            
            scanStatus.hidden = false;
            resultTable.hidden = true;
            statusMessage.textContent = 'Scan en cours';
            statusMessage.classList.add('loading-dots');
            generalInfo.innerHTML = '';
            medicalInfo.innerHTML = '';

            const base64Image = await convertToBase64(imageFile);
            
            const prompt = `En tant qu'expert pharmaceutique, analyse cette image de médicament et fournis les informations suivantes de manière détaillée et structurée:

1. Nom commercial du médicament
2. Laboratoire pharmaceutique
3. Molécule (DCI/Principe actif)
4. Forme pharmaceutique (comprimé, gélule, solution, etc.)
5. Dosage précis
6. Classe thérapeutique
7. Indications thérapeutiques principales détaillées
8. Posologie recommandée (doses et fréquence selon l'âge/poids)
9. Mode d'administration spécifique
10. Contre-indications majeures
11. Effets secondaires fréquents
12. Interactions médicamenteuses importantes
13. Précautions particulières d'emploi
14. Conservation (conditions et durée)
15. Population à risque
16. Surveillance particulière nécessaire
17. Statut (prescription obligatoire ou non)
18. Fabricant
19. Recommandations pour la durée de validité`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }, {
                            inline_data: {
                                mime_type: imageFile.type,
                                data: base64Image
                            }
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Format de réponse invalide');
            }

            const textResponse = data.candidates[0].content.parts[0].text;
            
            const processedData = {
                name: extractInfoFromNumberedList(textResponse, 1) || "Information non disponible",
                laboratory: extractInfoFromNumberedList(textResponse, 2) || "Information non disponible",
                molecule: extractInfoFromNumberedList(textResponse, 3) || "Information non disponible",
                form: extractInfoFromNumberedList(textResponse, 4) || "Information non disponible",
                dosage: extractInfoFromNumberedList(textResponse, 5) || "Information non disponible",
                category: extractInfoFromNumberedList(textResponse, 6) || "Information non disponible",
                mainUse: extractInfoFromNumberedList(textResponse, 7) || "Information non disponible",
                posology: extractInfoFromNumberedList(textResponse, 8) || "Information non disponible",
                administration: extractInfoFromNumberedList(textResponse, 9) || "Information non disponible",
                contraindications: extractInfoFromNumberedList(textResponse, 10) || "Information non disponible",
                sideEffects: extractInfoFromNumberedList(textResponse, 11) || "Information non disponible",
                interactions: extractInfoFromNumberedList(textResponse, 12) || "Information non disponible",
                precautions: extractInfoFromNumberedList(textResponse, 13) || "Information non disponible",
                storage: extractInfoFromNumberedList(textResponse, 14) || "Information non disponible",
                riskPopulation: extractInfoFromNumberedList(textResponse, 15) || "Information non disponible",
                monitoring: extractInfoFromNumberedList(textResponse, 16) || "Information non disponible",
                status: extractInfoFromNumberedList(textResponse, 17) || "Information non disponible",
                manufacturer: extractInfoFromNumberedList(textResponse, 18) || "Information non disponible",
                expiry: extractInfoFromNumberedList(textResponse, 19) || "Information non disponible"
            };

            statusMessage.classList.remove('loading-dots');
            statusMessage.textContent = 'Scan terminé';
            const checkmark = document.createElement('span');
            checkmark.textContent = '✓';
            checkmark.className = 'success-checkmark';
            statusMessage.appendChild(checkmark);
            statusMessage.classList.add('success');

            displayResults(processedData);
            resultTable.hidden = false;

        } catch (error) {
            console.error('Erreur détaillée:', error);
            statusMessage.classList.remove('loading-dots');
            statusMessage.textContent = 'Erreur lors du scan';
            statusMessage.classList.add('error');

            const errorMessage = `
                <tr>
                    <td colspan="2" style="text-align: center; color: red;">
                        <i class="fas fa-exclamation-circle"></i> 
                        Une erreur est survenue lors de l'analyse. Veuillez réessayer.
                    </td>
                </tr>
            `;
            
            generalInfo.innerHTML = errorMessage;
            medicalInfo.innerHTML = errorMessage;
            resultTable.hidden = false;
        }
    }

    function displayResults(data) {
        const generalInfo = document.getElementById('generalInfo');
        const medicalInfo = document.getElementById('medicalInfo');
        
        generalInfo.innerHTML = '';
        medicalInfo.innerHTML = '';
        
        const generalInfos = {
            'Nom commercial': data.name,
            'Laboratoire': data.laboratory,
            'Molécule (DCI)': data.molecule,
            'Forme pharmaceutique': data.form,
            'Dosage': data.dosage,
            'Conservation': data.storage,
            'Date de péremption': data.expiry,
            'Fabricant': data.manufacturer,
            'Statut': data.status
        };

        const medicalInfos = {
            'Classe thérapeutique': data.category,
            'Indications principales': data.mainUse,
            'Posologie recommandée': data.posology,
            'Mode d\'administration': data.administration,
            'Contre-indications': data.contraindications,
            'Effets secondaires fréquents': data.sideEffects,
            'Interactions médicamenteuses': data.interactions,
            'Précautions particulières': data.precautions,
            'Population à risque': data.riskPopulation,
            'Surveillance particulière': data.monitoring
        };

        const createTableRows = (infoObj, tableBody) => {
            for (const [key, value] of Object.entries(infoObj)) {
                if (value && value !== "Information non disponible") {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="info-label"><strong>${key}</strong></td>
                        <td class="info-value">${value}</td>
                    `;
                    tableBody.appendChild(row);
                }
            }
        };

        createTableRows(generalInfos, generalInfo);
        createTableRows(medicalInfos, medicalInfo);
    }

    function extractInfoFromNumberedList(text, number) {
        const regex = new RegExp(`${number}[.).\\s]+([^\\n]+)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }

    function convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}); 