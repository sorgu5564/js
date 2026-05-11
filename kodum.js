// ============================================
// PEGASUS SMARTGO - FLIGHTAWARE ENTEGRASYONLU v21.14
// Küçük personel kartları + Güçlü bildirim sesi
// ============================================

(function() {
    if (document.getElementById('smartgo-mobile-app')) {
        document.getElementById('smartgo-mobile-app').remove();
    }

    console.log('%c✈️ Pegasus SmartGO v21.14 - Küçük Kartlar + Ses', 'color: #0066cc; font-size: 18px; font-weight: bold');

    // ============ GLOBAL DEĞİŞKENLER ============
    let token = null;
    let monitorInterval = null;
    let countdownIntervals = [];
    let isMonitoring = false;
    let hideCompletedTasks = true;
    let notificationEnabled = false;
    let scanIntervalMinutes = 5;
    let lastTaskCount = 0;
    let previousTasksMap = new Map();
    let isFirstScan = true;
    
    let currentConfig = {
        searchValue: 'SAHIN',
        hub: 'SAW',
        startHour: 0,
        endHour: 2
    };
    
    // ============ TOKEN BUL ============
    function getToken() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key);
            if (val && val.startsWith('eyJ') && val.length > 100) {
                token = val;
                console.log('✅ Token bulundu');
                return true;
            }
        }
        return false;
    }
    
    if (!getToken()) {
        alert('❌ Token bulunamadi! Lutfen SmartGO\'ya giris yapin.');
        return;
    }
    
    // ============ HAVAALANI VERİTABANI ============
    const airportDatabase = {
        'SAW': 'Sabiha Gökçen, İstanbul', 'IST': 'İstanbul Havalimanı',
        'AYT': 'Antalya', 'ESB': 'Esenboğa, Ankara',
        'ADB': 'Adnan Menderes, İzmir', 'DLM': 'Dalaman',
        'TZX': 'Trabzon', 'GZT': 'Gaziantep',
        'ADA': 'Adana', 'BJV': 'Milas-Bodrum',
        'SZF': 'Samsun Çarşamba', 'STN': 'London Stansted',
        'LHR': 'London Heathrow', 'AMS': 'Amsterdam Schiphol',
        'FRA': 'Frankfurt', 'MUC': 'Munich',
        'DUS': 'Düsseldorf', 'VIE': 'Vienna',
        'ZRH': 'Zurich', 'BCN': 'Barcelona',
        'CDG': 'Paris Charles de Gaulle', 'ORY': 'Paris Orly',
        'CGN': 'Cologne Bonn', 'STR': 'Stuttgart',
        'HAJ': 'Hannover', 'NUE': 'Nuremberg',
        'TBS': 'Tbilisi', 'EVN': 'Yerevan',
        'BAK': 'Baku', 'IKA': 'Tehran',
        'BEY': 'Beirut', 'AMM': 'Amman',
        'CAI': 'Cairo', 'HRG': 'Hurghada',
        'SSH': 'Sharm El Sheikh', 'KWI': 'Kuwait',
        'DOH': 'Doha', 'DXB': 'Dubai',
        'SHJ': 'Sharjah', 'AUH': 'Abu Dhabi',
        'MCT': 'Muscat'
    };
    
    function getAirportName(code) {
        if (!code) return '-';
        if (airportDatabase[code]) return `${code} (${airportDatabase[code]})`;
        return code;
    }
    
    // ============ UÇAK MODELİ ============
    function getAircraftTypeName(typeCode) {
        if (!typeCode) return null;
        const types = {
            'A321-200': 'Airbus A321-200', 'A321-251NX': 'Airbus A321neo',
            'A320-200': 'Airbus A320-200', 'A320-251N': 'Airbus A320neo',
            'B737-800': 'Boeing 737-800', 'B737-8': 'Boeing 737-8',
            'B738': 'Boeing 737-800', 'A21N': 'Airbus A321neo', 'A20N': 'Airbus A320neo',
            'A-320-186': 'Airbus A320-200', 'A321-251': 'Airbus A321neo'
        };
        return types[typeCode] || typeCode;
    }
    
    // ============ SÜRE FORMATLAMA ============
    function formatDurationWithSeconds(totalSeconds) {
        if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) return '0 saniye';
        if (totalSeconds <= 0) return '0 saniye';
        let secs = Math.floor(totalSeconds);
        let hours = Math.floor(secs / 3600);
        let minutes = Math.floor((secs % 3600) / 60);
        let seconds = secs % 60;
        let result = '';
        if (hours > 0) result += `${hours} saat `;
        if (minutes > 0) result += `${minutes} dakika `;
        if (seconds > 0 || (hours === 0 && minutes === 0)) result += `${seconds} saniye`;
        return result.trim();
    }
    
    // ============ +3 SAAT EKLEME ============
    function addThreeHoursToTime(timeStr) {
        if (!timeStr || timeStr === '-' || timeStr === 'null') return null;
        let cleanStr = String(timeStr).replace(/\(.*?\)/g, '').trim();
        let match = cleanStr.match(/(\d{1,2}):(\d{2})/);
        if (!match) return null;
        let h = parseInt(match[1]), m = match[2];
        return { display: `${String(h).padStart(2,'0')}:${m} (${String((h+3)%24).padStart(2,'0')}:${m})` };
    }
    
    function formatDateTimeWithPlus3(dateStr) {
        if (!dateStr) return null;
        try {
            let d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            let hh = String(d.getHours()).padStart(2,'0'), mm = String(d.getMinutes()).padStart(2,'0');
            return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${hh}:${mm} (${String((d.getHours()+3)%24).padStart(2,'0')}:${mm})`;
        } catch(e) { return dateStr; }
    }
    
    function formatDateTime(dateStr) {
        if (!dateStr) return null;
        try { let d = new Date(dateStr); return isNaN(d.getTime()) ? dateStr : d.toLocaleString('tr-TR'); } catch(e) { return dateStr; }
    }
    
    // ============ SHAREPOINT PROFİL LİNKİ ============
    function getSharePointProfileUrl(personnelCode) {
        if (!personnelCode) return '#';
        return `https://flypgs.sharepoint.com/sites/pin#/tr/Profile/${encodeURIComponent(personnelCode)}`;
    }
    
    // ============ GERİ SAYIM HEDEFİ ============
    function getCountdownTarget(flight) {
        const now = new Date();
        let result = { type: null, targetTime: null, secondsLeft: Infinity, dangerLevel: 0 };
        
        let hasDeparted = !!(flight.Departure_ATDOffBlock && flight.Departure_ATDOffBlock !== '-');
        let hasArrived = !!(flight.Arrival_ATAOnBlock && flight.Arrival_ATAOnBlock !== '-');
        
        let arrTarget = null, arrSeconds = null;
        if (!hasArrived && flight.Arrival_STA && flight.Arrival_STA !== '-') {
            try {
                let parts = flight.Arrival_STA.split(':');
                let plus3Hours = (parseInt(parts[0]) + 3) % 24;
                let staDate = new Date();
                staDate.setHours(plus3Hours, parseInt(parts[1]), 0, 0);
                if (staDate <= now) staDate.setDate(staDate.getDate() + 1);
                arrTarget = staDate;
                arrSeconds = Math.floor((arrTarget - now) / 1000);
            } catch(e) {}
        }
        
        let depTarget = null, depSeconds = null;
        if (!hasDeparted && flight.Departure_STD && flight.Departure_STD !== '-') {
            try {
                let parts = flight.Departure_STD.split(':');
                let plus3Hours = (parseInt(parts[0]) + 3) % 24;
                let stdDate = new Date();
                stdDate.setHours(plus3Hours, parseInt(parts[1]), 0, 0);
                if (stdDate <= now) stdDate.setDate(stdDate.getDate() + 1);
                depTarget = stdDate;
                depSeconds = Math.floor((depTarget - now) / 1000);
            } catch(e) {}
        }
        
        if (!hasArrived && arrTarget && arrSeconds !== null && arrSeconds > 0) {
            result.type = 'arrival'; result.targetTime = arrTarget; result.secondsLeft = arrSeconds;
        } else if (!hasDeparted && depTarget && depSeconds !== null && depSeconds > 0) {
            result.type = 'departure'; result.targetTime = depTarget; result.secondsLeft = depSeconds;
        } else if (arrSeconds !== null && arrSeconds > 0) {
            result.type = 'arrival'; result.targetTime = arrTarget; result.secondsLeft = arrSeconds;
        } else if (depSeconds !== null && depSeconds > 0) {
            result.type = 'departure'; result.targetTime = depTarget; result.secondsLeft = depSeconds;
        }
        
        if (result.secondsLeft !== null && result.secondsLeft !== Infinity && result.secondsLeft > 0) {
            let mins = Math.floor(result.secondsLeft / 60);
            if (mins <= 5) result.dangerLevel = 3;
            else if (mins <= 15) result.dangerLevel = 2;
            else if (mins <= 30) result.dangerLevel = 1;
        }
        
        return result;
    }
    
    // ============ FLIGHT AWARE BUTONU ============
    function getFlightAwareButton(regSerial) {
        if (!regSerial || regSerial === '-' || regSerial === 'null') return '';
        return `<a href="https://tr.flightaware.com/live/flight/${regSerial.replace(/-/g,'')}" target="_blank" class="flightaware-btn">✈️ FlightAware ile Uçak Takibi</a>`;
    }
    
    // ============ GÜÇLÜ BİLDİRİM SESİ ============
    function playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Alarm benzeri daha belirgin ses
            const playBeep = (frequency, duration, startTime, volume = 0.7) => {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                oscillator.type = 'square'; // square dalga daha belirgin
                oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + startTime);
                gainNode.gain.setValueAtTime(volume, audioCtx.currentTime + startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + startTime + duration);
                
                oscillator.start(audioCtx.currentTime + startTime);
                oscillator.stop(audioCtx.currentTime + startTime + duration);
            };
            
            // 5 kısa, yüksek frekanslı bip (acil durum alarmı gibi)
            for (let i = 0; i < 5; i++) {
                playBeep(880, 0.15, i * 0.15, 0.8); // 880Hz, 150ms
            }
            
            // 2 uzun bip
            setTimeout(() => {
                for (let i = 0; i < 2; i++) {
                    playBeep(660, 0.3, i * 0.35, 0.7); // 660Hz, 300ms
                }
            }, 800);
            
        } catch(e) {
            console.warn('Ses çalınamadı:', e);
        }
    }
    
    async function requestNotificationPermission() {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                new Notification('✅ Bildirimler Aktif', {
                    body: 'Yeni görev atamaları size bildirilecek!',
                    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%231a5bbf"/%3E%3Ctext x="50" y="65" font-size="50" text-anchor="middle" fill="white"%3E✈️%3C/text%3E%3C/svg%3E'
                });
                playNotificationSound();
                return true;
            }
            return false;
        } catch(e) { return false; }
    }
    
    function checkNewTasksAndNotify(currentTasks, searchValue) {
        if (isFirstScan) {
            let currentTaskMap = new Map();
            currentTasks.forEach(task => {
                let code = task.assignedEmployeeCode || task.assignedEmployeeName || '?';
                let legIsn = String(task.legIsn || task.taskCode || '?');
                if (!currentTaskMap.has(code)) currentTaskMap.set(code, new Set());
                currentTaskMap.get(code).add(legIsn);
            });
            previousTasksMap = currentTaskMap;
            isFirstScan = false;
            return 0;
        }
        
        let currentTaskMap = new Map();
        currentTasks.forEach(task => {
            let code = task.assignedEmployeeCode || task.assignedEmployeeName || '?';
            let legIsn = String(task.legIsn || task.taskCode || '?');
            if (!currentTaskMap.has(code)) currentTaskMap.set(code, new Set());
            currentTaskMap.get(code).add(legIsn);
        });
        
        let newTasksFound = [];
        currentTaskMap.forEach((legSet, code) => {
            if (previousTasksMap.has(code)) {
                let oldLegSet = previousTasksMap.get(code);
                legSet.forEach(leg => {
                    if (!oldLegSet.has(leg)) {
                        let task = currentTasks.find(t => 
                            String(t.legIsn || t.taskCode) === leg && 
                            (t.assignedEmployeeCode === code || t.assignedEmployeeName === code)
                        );
                        if (task) newTasksFound.push({
                            code, name: task.assignedEmployeeName || code,
                            legIsn: leg, taskName: task.taskName || '?', flightNo: task.flightNo || '?'
                        });
                    }
                });
            }
        });
        
        if (newTasksFound.length > 0) {
            playNotificationSound();
            newTasksFound.forEach((newTask, index) => {
                setTimeout(() => {
                    try {
                        if (Notification.permission === 'granted') {
                            new Notification(`🆕 Yeni Görev: ${newTask.name}`, {
                                body: `${newTask.taskName}\nUçuş: ${newTask.flightNo}\nLeg: ${newTask.legIsn}`,
                                icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%2328a745"/%3E%3Ctext x="50" y="65" font-size="50" text-anchor="middle" fill="white"%3E🆕%3C/text%3E%3C/svg%3E',
                                tag: 'new-task-' + newTask.legIsn
                            });
                        }
                        addLog(`🆕 YENİ GÖREV: ${newTask.name} → ${newTask.taskName} (${newTask.flightNo})`, true);
                    } catch(e) {}
                }, index * 500);
            });
            setTimeout(() => playNotificationSound(), 800);
        }
        
        previousTasksMap = currentTaskMap;
        return newTasksFound.length;
    }
    
    // ============ API ============
    async function fetchFlights() {
        let now = new Date();
        let resp = await fetch('https://smartgo.flypgs.com/api/flight/getFlightsAndWFCFlights', {
            method: 'POST',
            headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
            body: JSON.stringify({ hub:currentConfig.hub, search:{type:2, start:new Date(now.getTime()+currentConfig.startHour*3600000).toISOString(), end:new Date(now.getTime()+currentConfig.endHour*3600000).toISOString(), intervalStart:currentConfig.startHour, intervalEnd:currentConfig.endHour}, fromserver:true })
        });
        let data = await resp.json();
        return data.result || [];
    }
    
    async function fetchTasksForLeg(legIsn) {
        try {
            let resp = await fetch('https://smartgo.flypgs.com/api/flight-task/get-tasks', {
                method:'POST', headers:{'accept':'application/json','authorization':'Bearer '+token,'content-type':'application/json'},
                body: JSON.stringify({legIsn:parseInt(legIsn), hub:currentConfig.hub})
            });
            let data = await resp.json();
            return Array.isArray(data) ? data : (data.result || data.data || []);
        } catch(e) { return []; }
    }
    
    async function fetchLoadsheet(legIsn) {
        try {
            let resp = await fetch(`https://smartgo.flypgs.com/api/loadsheet/getloadsheet/${legIsn}`, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
            });
            if (!resp.ok) { console.warn(`Loadsheet HTTP ${resp.status}: ${legIsn}`); return null; }
            let data = await resp.json();
            if (data && data.isSucceeded && data.result && data.result.length > 0) {
                console.log(`✅ Loadsheet: Leg ${legIsn}, Uçuş: ${data.result[0].flightInfo?.flightNo || '?'}`);
                return data.result[0];
            }
            return null;
        } catch(e) { console.warn('Loadsheet hata:', legIsn, e.message); return null; }
    }
    
    function isValidValue(v) {
        return !(v === null || v === undefined || v === '' || v === '-' || v === 'null' || v === 'undefined');
    }
    
    const statusLabels = {0:'Bilgi Yok',1:'Frekans Gönderildi',2:'İniş Yaptı',3:'Kapı Kapandı',4:'Havalandı',5:'Kalkış Yaptı'};
    const taskStatusLabels = {'Waiting':'Bekliyor','Started':'Başladı','Accepted':'Kabul Edildi','Finished':'Tamamlandı','Rejected':'Reddedildi'};
    
    function getTimeRangeText() {
        let s = currentConfig.startHour === 0 ? 'Şu an' : `${currentConfig.startHour} saat sonra`;
        let e = currentConfig.endHour === 0 ? 'Şu an' : `${currentConfig.endHour} saat sonra`;
        return `${s} - ${e}`;
    }
    
    // ============ LOADSHEET HTML ============
    function getLoadsheetHtml(loadsheetData, type) {
        if (!loadsheetData) return '';
        
        let emoji = type === 'dep' ? '🛫' : '🛬';
        let label = type === 'dep' ? 'KALKIŞ' : 'VARIŞ';
        let bgColor = type === 'dep' ? '#d1ecf1' : '#d4edda';
        let borderColor = type === 'dep' ? '#0c5460' : '#155724';
        
        let info = loadsheetData.flightInfo || {};
        let loadInfo = loadsheetData.loadInCompartment?.destinations?.[0] || {};
        let passenger = loadsheetData.passenger?.destinations?.[0] || {};
        let balance = loadsheetData.balanceAndSeatingCondition || {};
        let ldmRaw = loadsheetData.loadMessage?.ldm || '';
        let siRaw = loadsheetData.loadMessage?.si || '';
        
        return `
            <div style="background:${bgColor};border-radius:10px;padding:10px;margin-top:10px;border-left:4px solid ${borderColor}">
                <div style="font-weight:700;font-size:12px;color:${borderColor};margin-bottom:8px">${emoji} ${label} LOADSHEET</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:4px;margin-bottom:6px">
                    <div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">✈️ Uçuş</div><div style="font-weight:700;font-size:11px;color:#1a5bbf">${info.flightNo || '-'}</div></div>
                    <div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">🆔 Tescil</div><div style="font-weight:700;font-size:11px">${info.acReg || '-'}</div></div>
                    <div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">📋 Tip</div><div style="font-weight:700;font-size:11px">${info.acType || '-'}</div></div>
                    <div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">🛫→🛬</div><div style="font-weight:700;font-size:10px">${info.departurePort || '-'}→${info.arrivalPort || '-'}</div></div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:4px;margin-bottom:6px">
                    <div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">👥 Yolcu</div><div style="font-weight:700;font-size:12px;color:#1a5bbf">${loadsheetData.totalPassenger || '-'}</div></div>
                    <div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">💺 Dağılım</div><div style="font-weight:700;font-size:9px">${passenger.passengerDistribution || loadsheetData.passengerCabinBagDistribution || '-'}</div></div>
                    <div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">⚖️ Yolcu Ağ.</div><div style="font-weight:700;font-size:11px">${loadsheetData.passenger?.weight || '-'} ${loadsheetData.weightUnitType || 'KG'}</div></div>
                    <div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">🧳 Bagaj</div><div style="font-weight:700;font-size:10px">${loadInfo.baggageCount || 0} ad/${loadInfo.baggageWeight || 0} ${loadsheetData.weightUnitType || 'KG'}</div></div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:4px;margin-bottom:6px">
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">DOW</div><div style="font-weight:700;font-size:10px">${loadsheetData.dow || 0}</div></div>
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">Trafik</div><div style="font-weight:700;font-size:10px">${loadsheetData.totalTrafficLoad || 0}</div></div>
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">TOF</div><div style="font-weight:700;font-size:10px">${loadsheetData.takeoffFuel || 0}</div></div>
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">Trip</div><div style="font-weight:700;font-size:10px">${loadsheetData.tripFuel || 0}</div></div>
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">ZFW</div><div style="font-weight:700;font-size:10px">${loadsheetData.zeroFuelWeight?.actual || 0}</div></div>
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">TOW</div><div style="font-weight:700;font-size:10px">${loadsheetData.takeOffWeight?.actual || 0}</div></div>
                </div>
                <div style="background:white;border-radius:6px;padding:6px;margin-bottom:6px">
                    <div style="font-size:7px;color:#6c757d;margin-bottom:2px">📦 KOMPARTMAN</div>
                    <div style="font-weight:600;font-size:10px;font-family:monospace">${loadInfo.holdDistribution || loadsheetData.loadInCompartmentDistribution || '-'}</div>
                    <div style="font-size:8px;color:#6c757d;margin-top:1px">Toplam: ${loadsheetData.totalHoldWeight || 0} ${loadsheetData.weightUnitType || 'KG'}</div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:6px">
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">DOI</div><div style="font-weight:700;font-size:9px">${balance.doi || 0}</div></div>
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">LIZFW</div><div style="font-weight:700;font-size:9px">${balance.lizfw || 0}</div></div>
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">MACZFW</div><div style="font-weight:700;font-size:9px">${balance.maczfw || 0}%</div></div>
                    <div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">MACTOW</div><div style="font-weight:700;font-size:9px">${balance.mactow || 0}%</div></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:8px;color:#6c757d;flex-wrap:wrap;gap:3px;margin-bottom:6px">
                    <span>✍️ ${loadsheetData.preparedBy || '-'}</span>
                    <span>✅ ${loadsheetData.checkedBy || '-'}</span>
                    <span>📋 ${loadsheetData.approvedBy || loadsheetData.loadSheetStatus?.approvedBy || '-'}</span>
                </div>
                ${ldmRaw ? `<div style="background:#1e1e2e;border-radius:6px;padding:8px;margin-top:4px"><div style="font-size:9px;color:#a0ffa0;margin-bottom:4px;font-weight:700">📄 LDM</div><pre style="color:#a0ffa0;font-family:monospace;font-size:8px;white-space:pre-wrap;word-break:break-all;max-height:150px;overflow-y:auto;margin:0;line-height:1.3">${escapeHtml(ldmRaw)}</pre></div>` : ''}
                ${siRaw ? `<div style="background:#2e1e1e;border-radius:6px;padding:8px;margin-top:3px"><div style="font-size:9px;color:#ffa0a0;margin-bottom:4px;font-weight:700">📋 SI</div><pre style="color:#ffa0a0;font-family:monospace;font-size:8px;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow-y:auto;margin:0;line-height:1.3">${escapeHtml(siRaw)}</pre></div>` : ''}
            </div>
        `;
    }
    
    // ============ ARAYÜZ ============
    function createAppInterface() {
        let app = document.createElement('div');
        app.id = 'smartgo-mobile-app';
        app.innerHTML = `
<style>
*{margin:0;padding:0;box-sizing:border-box}
#smartgo-mobile-app{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;background:#f0f2f5!important;color:#1a1a2e!important;z-index:2147483647!important;font-family:'Segoe UI',system-ui,sans-serif!important;overflow-y:auto!important;display:flex!important;flex-direction:column!important}
.app-header{background:linear-gradient(135deg,#1a5bbf,#004e9e)!important;padding:10px 16px!important;position:sticky!important;top:0!important;z-index:100!important}
.app-header h1{font-size:16px;color:#fff}
.close-btn{position:absolute;top:10px;right:12px;background:rgba(255,255,255,.2);border:none;width:28px;height:28px;border-radius:50%;color:#fff;font-size:16px;cursor:pointer}
.control-panel{background:#fff;padding:8px 12px;border-bottom:1px solid #e0e0e0}
.control-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.control-row:first-child{margin-top:0}
.status-badge{display:flex;align-items:center;gap:6px;background:#e9ecef;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:500}
.status-dot{width:8px;height:8px;border-radius:50%}
.status-dot.active{background:#28a745;box-shadow:0 0 4px #28a745}
.status-dot.stopped{background:#dc3545}
.search-input,.hub-select,.interval-select{background:#f8f9fa;border:1px solid #dee2e6;padding:6px 10px;border-radius:20px;font-size:12px}
.search-input{flex:1;min-width:120px}
.time-range-group{display:flex;align-items:center;gap:4px;background:#f8f9fa;padding:3px 8px;border-radius:20px;border:1px solid #dee2e6}
.time-input{width:45px;background:0 0;border:none;padding:4px 0;font-size:12px;text-align:center}
.checkbox-label{display:flex;align-items:center;gap:6px;background:#e9ecef;padding:5px 10px;border-radius:20px;font-size:11px;cursor:pointer}
.btn{padding:6px 14px;border-radius:20px;border:none;font-weight:600;font-size:11px;cursor:pointer;transition:.2s}
.btn-primary{background:#1a5bbf;color:#fff}.btn-danger{background:#dc3545;color:#fff}
.btn-success{background:#28a745;color:#fff}.btn-warning{background:#ffc107;color:#1a1a2e}
.stats-grid{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:#fff}
.stat-card{background:#f8f9fa;border-radius:10px;padding:6px 10px;text-align:center;flex:1;min-width:55px}
.stat-number{font-size:18px;font-weight:700;color:#1a5bbf}.stat-label{font-size:8px;color:#6c757d}
.content-area{flex:1;padding:12px;overflow-y:auto}
.flight-card{background:#fff;border-radius:16px;margin-bottom:14px;border:2px solid #e9ecef;transition:all .5s}
.flight-card.danger-level-1{border-color:#ffc107;box-shadow:0 0 10px rgba(255,193,7,.3)}
.flight-card.danger-level-2{border-color:#fd7e14;box-shadow:0 0 15px rgba(253,126,20,.4);animation:pulse-orange 2s infinite}
.flight-card.danger-level-3{border-color:#dc3545;box-shadow:0 0 20px rgba(220,53,69,.6);animation:pulse-red 1s infinite}
@keyframes pulse-orange{50%{box-shadow:0 0 25px rgba(253,126,20,.7)}}
@keyframes pulse-red{50%{box-shadow:0 0 30px rgba(220,53,69,.9)}}
.flight-card-header{background:linear-gradient(135deg,#f8f9fa,#f1f3f5);padding:8px 12px}
.flight-title{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px}
.flight-number{font-size:15px;font-weight:700;color:#1a5bbf}
.flight-card-body{padding:12px}
.countdown-display{border-radius:12px;padding:10px 14px;margin:8px 0;text-align:center;font-weight:700;font-size:14px}
.countdown-departure{background:linear-gradient(135deg,#d1ecf1,#bee5eb);color:#0c5460;border-left:4px solid #0c5460}
.countdown-arrival{background:linear-gradient(135deg,#d4edda,#c3e6cb);color:#155724;border-left:4px solid #155724}
.countdown-urgent{background:linear-gradient(135deg,#f8d7da,#f5c6cb)!important;color:#721c24!important;animation:pulse-bg 1s infinite}
@keyframes pulse-bg{50%{opacity:.7}}
.info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-bottom:12px}
.info-item{background:#f8f9fa;border-radius:10px;padding:8px 10px;border-left:3px solid #1a5bbf}
.info-label{font-size:8px;font-weight:600;color:#6c757d;text-transform:uppercase;margin-bottom:2px}
.info-value{font-size:11px;font-weight:500}
.info-value.cargo{color:#e67e22;font-weight:600}
.personnel-code-link{display:inline-block;background:#1a5bbf;color:#fff!important;padding:2px 8px;border-radius:15px;font-size:9px;font-weight:700;font-family:monospace;text-decoration:none;cursor:pointer}
.personnel-code-link:hover{background:#004e9e}

/* KÜÇÜK PERSONEL KARTLARI */
.personnel-mini-card{background:#f8f9fa;border-radius:8px;margin-bottom:5px;overflow:hidden;font-size:10px}
.personnel-mini-header{background:#e9ecef;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px}
.personnel-mini-name{font-weight:700;font-size:11px}
.personnel-mini-body{padding:6px 10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:4px}
.personnel-mini-task{background:#fff;border-radius:6px;padding:4px 8px;font-size:9px;border-left:2px solid #1a5bbf}
.personnel-mini-task-label{font-size:7px;color:#6c757d;text-transform:uppercase;margin-bottom:1px}
.personnel-mini-task-value{font-size:9px;font-weight:500}
.personnel-mini-status{padding:1px 6px;border-radius:20px;font-size:8px;font-weight:600}
.personnel-highlight{border:2px solid #1a5bbf!important;box-shadow:0 0 8px rgba(26,91,191,0.3)!important}
.searched-badge{background:#1a5bbf;color:#fff;padding:1px 6px;border-radius:15px;font-size:8px;font-weight:700}

.status-Waiting{background:#fff3cd;color:#856404}.status-Started{background:#d1ecf1;color:#0c5460}
.status-Accepted{background:#d4edda;color:#155724}.status-Finished{background:#cce5ff;color:#004085}
.status-Rejected{background:#f8d7da;color:#721c24}
.flightaware-btn{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#1a5bbf,#004e9e);color:#fff;padding:6px 12px;border-radius:20px;text-decoration:none;font-size:11px;font-weight:600;margin-top:6px}
.log-area{background:#1e1e2e;padding:6px 12px;max-height:60px;overflow-y:auto;font-size:8px;font-family:monospace}
.log-entry{padding:2px 0;color:#a0ffa0;border-bottom:1px solid #333}
.log-entry.new-task{color:#ffc107;font-weight:bold}
.loading{text-align:center;padding:30px;color:#6c757d}
.section-title{font-size:13px;font-weight:700;margin:12px 0 8px;padding-left:8px;border-left:3px solid #1a5bbf}
@media(max-width:600px){.info-grid{grid-template-columns:1fr}.personnel-mini-body{grid-template-columns:1fr}}
</style>
<div class="app-header">
<button class="close-btn" id="closeAppBtn">✕</button>
<h1>✈️ Pegasus SmartGO <small>v21.14 🔊</small></h1>
<div class="time-range"><span>🕐</span><span id="timeRangeText">${getTimeRangeText()}</span></div>
</div>
<div class="control-panel">
<div class="control-row">
<div class="status-badge"><span class="status-dot" id="statusDot"></span><span id="statusText">Duruyor</span></div>
<input id="searchInput" class="search-input" placeholder="Personel adı/kodu..." value="SAHIN">
<select id="hubSelect" class="hub-select"><option value="SAW">SAW</option><option value="AYT">AYT</option><option value="ESB">ESB</option><option value="ADB">ADB</option><option value="DLM">DLM</option></select>
</div>
<div class="control-row">
<div class="time-range-group"><span>📅</span><input id="startHour" class="time-input" value="0" type="number"><span>→</span><input id="endHour" class="time-input" value="2" type="number"><span>saat</span></div>
<select id="intervalSelect" class="interval-select"><option value="1">1 dk</option><option value="3">3 dk</option><option value="5" selected>5 dk</option><option value="10">10 dk</option><option value="30">30 dk</option></select>
<label class="checkbox-label"><input id="hideCompletedCheckbox" type="checkbox" checked><span>✅ Tamamlananları gizle</span></label>
<button id="notifyBtn" class="btn btn-warning">🔔</button>
<button id="startBtn" class="btn btn-primary">▶️ Başlat</button>
<button id="stopBtn" class="btn btn-danger">⏹️ Durdur</button>
<button id="refreshBtn" class="btn btn-success">🔄 Tara</button>
</div>
</div>
<div class="stats-grid">
<div class="stat-card"><div class="stat-number" id="statFlights">0</div><div class="stat-label">Uçuş</div></div>
<div class="stat-card"><div class="stat-number" id="statTasks">0</div><div class="stat-label">Görev</div></div>
<div class="stat-card"><div class="stat-number" id="statPersonel">0</div><div class="stat-label">Personel</div></div>
<div class="stat-card"><div class="stat-number" id="statYKB">0</div><div class="stat-label">YKB</div></div>
<div class="stat-card"><div class="stat-number" id="statActive">0</div><div class="stat-label">Aktif</div></div>
</div>
<div class="content-area" id="contentArea"><div class="loading"><h3>✈️ SmartGO Takip</h3><p>Başlat'a tıklayın</p></div></div>
<div class="log-area" id="logArea"><div class="log-entry">✅ v21.14 - Küçük kartlar + Güçlü ses</div></div>
`;
        document.body.appendChild(app);
        
        document.getElementById('closeAppBtn').onclick = () => { 
            clearAllCountdowns(); if(monitorInterval) clearInterval(monitorInterval); 
            previousTasksMap.clear(); isFirstScan = true; app.remove(); 
        };
        document.getElementById('startBtn').onclick = startMonitoring;
        document.getElementById('stopBtn').onclick = stopMonitoring;
        document.getElementById('refreshBtn').onclick = forceScan;
        document.getElementById('notifyBtn').onclick = async () => {
            notificationEnabled = await requestNotificationPermission();
            if(notificationEnabled) { 
                document.getElementById('notifyBtn').style.background='#28a745'; 
                document.getElementById('notifyBtn').style.color='white'; 
                document.getElementById('notifyBtn').textContent='🔊 Aktif'; 
            }
        };
        ['startHour','endHour'].forEach(id => document.getElementById(id).onchange = e => {
            let v = parseInt(e.target.value) || 0;
            if(id==='startHour') currentConfig.startHour = v; else currentConfig.endHour = v;
            document.getElementById('timeRangeText').innerText = getTimeRangeText();
            if(isMonitoring) forceScan();
        });
        document.getElementById('searchInput').onchange = e => { 
            currentConfig.searchValue = e.target.value; previousTasksMap.clear(); isFirstScan = true; if(isMonitoring) forceScan(); 
        };
        document.getElementById('hubSelect').onchange = e => { currentConfig.hub = e.target.value; if(isMonitoring) forceScan(); };
        document.getElementById('intervalSelect').onchange = e => {
            scanIntervalMinutes = parseInt(e.target.value);
            if(isMonitoring && monitorInterval) { clearInterval(monitorInterval); monitorInterval = setInterval(performScan, scanIntervalMinutes*60000); }
        };
        document.getElementById('hideCompletedCheckbox').onchange = e => { hideCompletedTasks = e.target.checked; if(isMonitoring) forceScan(); };
    }
    
    function addLog(msg, isNewTask = false) {
        let area = document.getElementById('logArea'); if(!area) return;
        let div = document.createElement('div'); 
        div.className = 'log-entry' + (isNewTask ? ' new-task' : '');
        div.innerHTML = `[${new Date().toLocaleTimeString('tr-TR')}] ${msg}`;
        area.appendChild(div); area.scrollTop = area.scrollHeight;
        while(area.children.length > 50) area.removeChild(area.firstChild);
    }
    
    function updateStats(f,t,p,y,a) {
        ['statFlights','statTasks','statPersonel','statYKB','statActive'].forEach((id,i) => { let el = document.getElementById(id); if(el) el.textContent = [f,t,p,y,a][i]; });
    }
    
    function escapeHtml(s) { 
        if (!s) return ''; 
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    
    function clearAllCountdowns() { countdownIntervals.forEach(id => clearInterval(id)); countdownIntervals = []; }
    
    // ============ RENDER (KÜÇÜK PERSONEL KARTLARI) ============
    function renderContent(flights, tasks, loadsheetMap, allTasksMap) {
        clearAllCountdowns();
        let container = document.getElementById('contentArea'); if(!container) return;
        
        let flightsWithCountdown = flights.map(flight => {
            let countdown = getCountdownTarget(flight);
            let flightNo = flight.Departure_FlightNo || flight.Arrival_FlightNo || '??';
            let flightTasks = tasks.filter(t => t.flightNo === flightNo);
            let allFlightTasks = allTasksMap?.get(flightNo) || flightTasks;
            return { flight, countdown, flightNo, flightTasks, allFlightTasks };
        });
        
        flightsWithCountdown.sort((a, b) => {
            let secA = a.countdown.secondsLeft !== null && a.countdown.secondsLeft !== Infinity ? a.countdown.secondsLeft : 999999;
            let secB = b.countdown.secondsLeft !== null && b.countdown.secondsLeft !== Infinity ? b.countdown.secondsLeft : 999999;
            return secA - secB;
        });
        
        let html = '';
        let searchValue = (currentConfig.searchValue || 'SAHIN').toLowerCase();
        
        for (let { flight, countdown, flightNo, flightTasks, allFlightTasks } of flightsWithCountdown) {
            let dangerClass = countdown.dangerLevel > 0 ? ` danger-level-${countdown.dangerLevel}` : '';
            let statusIcon = countdown.dangerLevel===3?'🔴 ':countdown.dangerLevel===2?'🟠 ':countdown.dangerLevel===1?'🟡 ':'';
            
            let infoItems = [];
            if (isValidValue(flight.Departure_Port)) {
                let details = getAirportName(flight.Departure_Port);
                if (isValidValue(flight.Departure_ParkPosition)) details += ` | 🅿️ ${flight.Departure_ParkPosition}`;
                if (isValidValue(flight.Departure_Gate)) details += ` | 🚪 ${flight.Departure_Gate}`;
                infoItems.push({label:'🛫 KALKIŞ', value: details});
            }
            if (isValidValue(flight.Arrival_Port)) {
                let details = getAirportName(flight.Arrival_Port);
                if (isValidValue(flight.Arrival_ParkPosition)) details += ` | 🅿️ ${flight.Arrival_ParkPosition}`;
                if (isValidValue(flight.Arrival_Gate)) details += ` | 🚪 ${flight.Arrival_Gate}`;
                if (isValidValue(flight.Arrival_Carosel)) details += ` | 🎒 ${flight.Arrival_Carosel}`;
                infoItems.push({label:'🛬 VARIŞ', value: details});
            }
            if (isValidValue(flight.RegSerial)) {
                let type = getAircraftTypeName(flight.Departure_ACType || flight.Arrival_ACType);
                infoItems.push({label:'✈️ UÇAK', value: `${flight.RegSerial}${type?' ('+type+')':''}`, className:'aircraft'});
            }
            if (isValidValue(flight.Departure_CargoPiece) && isValidValue(flight.Departure_CargoKilo)) {
                let cargoText = `${flight.Departure_CargoPiece} adet / ${flight.Departure_CargoKilo} kg`;
                if (isValidValue(flight.Departure_CargoRemark)) cargoText += ` (${flight.Departure_CargoRemark})`;
                infoItems.push({label:'📦 KARGO', value: cargoText, className:'cargo'});
            }
            if (isValidValue(flight.Departure_STD)) {
                let t = addThreeHoursToTime(flight.Departure_STD);
                infoItems.push({label:'📅 PLAN. KALKIŞ', value: t ? t.display : flight.Departure_STD});
            }
            if (isValidValue(flight.Arrival_STA)) {
                let t = addThreeHoursToTime(flight.Arrival_STA);
                infoItems.push({label:'📅 PLAN. VARIŞ', value: t ? t.display : flight.Arrival_STA});
            }
            if (isValidValue(flight.Departure_ATDOffBlock)) infoItems.push({label:'✅ GERÇEK KALKIŞ', value: formatDateTimeWithPlus3(flight.Departure_ATDOffBlock)});
            if (isValidValue(flight.Arrival_ATAOnBlock)) infoItems.push({label:'✅ GERÇEK VARIŞ', value: formatDateTimeWithPlus3(flight.Arrival_ATAOnBlock)});
            if (isValidValue(flight.Departure_Note)) infoItems.push({label:'📝 NOT', value: escapeHtml(flight.Departure_Note)});
            
            let countdownHtml = '';
            if (countdown.type && countdown.targetTime && countdown.secondsLeft > 0) {
                let id = 'cd-' + flightNo.replace(/[^a-zA-Z0-9]/g, '-');
                let cls = countdown.type === 'departure' ? 'countdown-departure' : 'countdown-arrival';
                let emoji = countdown.type === 'departure' ? '🛫' : '🛬';
                let label = countdown.type === 'departure' ? 'Kalkışa' : 'Varışa';
                countdownHtml = `<div id="${id}" class="countdown-display ${cls}" data-target="${countdown.targetTime.toISOString()}">${emoji} ${label} son: <span class="countdown-timer">${formatDurationWithSeconds(countdown.secondsLeft)}</span></div>`;
            }
            
            let loadsheetHtml = '';
            if (flight.Departure_LegIsn && loadsheetMap.has(flight.Departure_LegIsn)) loadsheetHtml += getLoadsheetHtml(loadsheetMap.get(flight.Departure_LegIsn), 'dep');
            if (flight.Arrival_LegIsn && loadsheetMap.has(flight.Arrival_LegIsn)) loadsheetHtml += getLoadsheetHtml(loadsheetMap.get(flight.Arrival_LegIsn), 'arr');
            
            // TÜM PERSONELİ GRUPLA
            let personelMap = new Map();
            for (let t of allFlightTasks) {
                let key = t.assignedEmployeeName || 'Bilinmeyen';
                if (!personelMap.has(key)) {
                    personelMap.set(key, { tasks: [], code: t.assignedEmployeeCode || null, phone: t.assignedEmployeeMobilePhone || null });
                }
                personelMap.get(key).tasks.push(t);
            }
            
            // KÜÇÜK PERSONEL KARTLARI
            let tasksHtml = '';
            for (let [name, data] of personelMap) {
                let isYKB = data.tasks.some(t => t.taskName && t.taskName.toLowerCase().includes('ykb'));
                let phoneLink = data.phone ? `https://wa.me/${data.phone.replace(/\D/g,'')}` : null;
                let codeHtml = data.code ? `<a href="${getSharePointProfileUrl(data.code)}" target="_blank" class="personnel-code-link">🔑 ${escapeHtml(data.code)}</a>` : '';
                let isSearched = name.toLowerCase().includes(searchValue) || (data.code && data.code.toLowerCase().includes(searchValue));
                let highlightClass = isSearched ? ' personnel-highlight' : '';
                let searchedBadge = isSearched ? ' <span class="searched-badge">🎯</span>' : '';
                
                let titleHtml = `<span class="personnel-mini-name">👤 ${escapeHtml(name)}</span> ${codeHtml}${searchedBadge}`;
                if (isYKB) titleHtml += ' <span style="background:#ffc107;color:#333;padding:1px 6px;border-radius:15px;font-size:8px;font-weight:700">⭐ YKB</span>';
                if (phoneLink) titleHtml += ` <a href="${phoneLink}" target="_blank" style="color:#25D366;text-decoration:none;font-weight:500;font-size:9px">📱</a>`;
                
                let taskCards = data.tasks.map(task => {
                    let statusClass = task.taskStatusText || 'Waiting';
                    return `
                        <div class="personnel-mini-task">
                            <div class="personnel-mini-task-label">📋 ${escapeHtml(task.taskName || 'Görev')} <span class="personnel-mini-status status-${statusClass}">${taskStatusLabels[statusClass] || statusClass}</span></div>
                            <div class="personnel-mini-task-value">${escapeHtml(task.taskCode || '-')} | ${formatDateTime(task.scheduledStartTime) || '-'} → ${formatDateTime(task.scheduledEndTime) || '-'}</div>
                        </div>`;
                }).join('');
                
                tasksHtml += `<div class="personnel-mini-card${highlightClass}"><div class="personnel-mini-header"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${titleHtml}</div><span style="font-size:9px;color:#6c757d">📋 ${data.tasks.length}</span></div><div class="personnel-mini-body">${taskCards}</div></div>`;
            }
            
            let totalPersonnel = personelMap.size;
            let sectionTitle = `👥 PERSONEL (${totalPersonnel} kişi)`;
            
            html += `<div class="flight-card${dangerClass}"><div class="flight-card-header"><div class="flight-title"><div class="flight-number">${statusIcon}✈️ ${escapeHtml(flightNo)} <span class="flight-status">${statusLabels[flight.Status]||'?'}</span>${isValidValue(flight.RegSerial)?` <span class="flight-reg">${flight.RegSerial}</span>`:''}</div><span class="flight-badge">👥 ${totalPersonnel} | 📋 ${allFlightTasks.length}</span></div></div><div class="flight-card-body">${countdownHtml}<div class="info-grid">${infoItems.map(item => `<div class="info-item"><div class="info-label">${item.label}</div><div class="info-value ${item.className||''}">${item.value}</div></div>`).join('')}</div>${isValidValue(flight.RegSerial)?getFlightAwareButton(flight.RegSerial):''}${loadsheetHtml}<div class="section-title">${sectionTitle}</div>${tasksHtml}</div></div>`;
        }
        
        container.innerHTML = html || '<div class="loading"><h3>📭 Uçuş bulunamadı</h3></div>';
        
        document.querySelectorAll('.countdown-display').forEach(el => {
            let target = new Date(el.dataset.target);
            let timerEl = el.querySelector('.countdown-timer');
            let flightCard = el.closest('.flight-card');
            let update = () => {
                let secs = Math.floor((target - new Date()) / 1000);
                if (secs <= 0) { timerEl.textContent = '0 saniye'; el.classList.add('countdown-urgent'); if (flightCard) flightCard.classList.add('danger-level-3'); return; }
                timerEl.textContent = formatDurationWithSeconds(secs);
                let mins = Math.floor(secs / 60);
                if (flightCard) {
                    flightCard.classList.remove('danger-level-1', 'danger-level-2', 'danger-level-3');
                    if (mins <= 5) { flightCard.classList.add('danger-level-3'); el.classList.add('countdown-urgent'); }
                    else if (mins <= 15) { flightCard.classList.add('danger-level-2'); el.classList.remove('countdown-urgent'); }
                    else if (mins <= 30) { flightCard.classList.add('danger-level-1'); }
                }
            };
            update();
            countdownIntervals.push(setInterval(update, 1000));
        });
    }
    
    // ============ TARAMA ============
    async function performScan() {
        addLog(`🔍 Taranıyor...`);
        try {
            let flights = await fetchFlights();
            if (!flights.length) { addLog('⚠️ Uçuş bulunamadı'); return; }
            
            let legMap = new Map();
            flights.forEach(f => {
                let no = f.Departure_FlightNo || f.Arrival_FlightNo;
                if (f.Departure_LegIsn && f.Departure_LegIsn !== '-') legMap.set(f.Departure_LegIsn, {no, flight:f});
                if (f.Arrival_LegIsn && f.Arrival_LegIsn !== '-') legMap.set(f.Arrival_LegIsn, {no, flight:f});
            });
            
            let legs = [...legMap.keys()];
            let allTasks = [], loadsheetMap = new Map();
            let allTasksByFlight = new Map();
            
            for (let i = 0; i < legs.length; i += 2) {
                let batch = legs.slice(i, i + 2);
                try {
                    let [taskRes, loadsheetRes] = await Promise.all([
                        Promise.all(batch.map(l => fetchTasksForLeg(l).catch(e => { return []; }))),
                        Promise.all(batch.map(l => fetchLoadsheet(l).catch(e => { return null; })))
                    ]);
                    batch.forEach((leg, j) => {
                        let flightNo = legMap.get(leg)?.no || '-';
                        if (taskRes[j] && taskRes[j].length > 0) {
                            taskRes[j].forEach(t => {
                                let taskWithFlight = {...t, flightNo};
                                allTasks.push(taskWithFlight);
                                if (!allTasksByFlight.has(flightNo)) allTasksByFlight.set(flightNo, []);
                                allTasksByFlight.get(flightNo).push(taskWithFlight);
                            });
                        }
                        if (loadsheetRes[j]) loadsheetMap.set(leg, loadsheetRes[j]);
                    });
                } catch(batchError) {}
            }
            
            addLog(`📋 ${loadsheetMap.size} loadsheet, 👥 ${allTasksByFlight.size} uçuş`);
            
            let sv = currentConfig.searchValue || 'SAHIN';
            let filtered = allTasks.filter(t => (t.assignedEmployeeName||'').toLowerCase().includes(sv.toLowerCase()) || (t.assignedEmployeeCode||'').toLowerCase().includes(sv.toLowerCase()));
            let display = hideCompletedTasks ? filtered.filter(t => t.taskStatusText !== 'Finished') : filtered;
            
            let newTaskCount = checkNewTasksAndNotify(display, sv);
            if (newTaskCount > 0) addLog(`🆕 ${newTaskCount} yeni görev! 🔊`, true);
            
            let flightNos = new Set(display.map(t => t.flightNo));
            let filteredFlights = flights.filter(f => flightNos.has(f.Departure_FlightNo || f.Arrival_FlightNo));
            
            let personelSet = new Set(), ykb = 0;
            allTasks.forEach(t => {
                if (isValidValue(t.assignedEmployeeName)) personelSet.add(t.assignedEmployeeName);
                if (t.taskName && t.taskName.toLowerCase().includes('ykb')) ykb++;
            });
            
            renderContent(filteredFlights, display, loadsheetMap, allTasksByFlight);
            updateStats(filteredFlights.length, allTasks.length, personelSet.size, ykb, display.length);
            addLog(`✅ ${filteredFlights.length} uçuş, ${display.length} görev, 👥 ${personelSet.size} personel`);
        } catch(e) { addLog(`❌ ${e.message}`); }
    }
    
    async function startMonitoring() {
        if (isMonitoring) return;
        isMonitoring = true;
        previousTasksMap.clear(); isFirstScan = true;
        currentConfig.hub = document.getElementById('hubSelect').value;
        currentConfig.searchValue = document.getElementById('searchInput').value;
        currentConfig.startHour = parseInt(document.getElementById('startHour').value)||0;
        currentConfig.endHour = parseInt(document.getElementById('endHour').value)||2;
        hideCompletedTasks = document.getElementById('hideCompletedCheckbox').checked;
        scanIntervalMinutes = parseInt(document.getElementById('intervalSelect').value);
        
        if (!notificationEnabled && Notification.permission === 'default') {
            notificationEnabled = await requestNotificationPermission();
            if (notificationEnabled) { 
                document.getElementById('notifyBtn').style.background='#28a745'; 
                document.getElementById('notifyBtn').style.color='white'; 
                document.getElementById('notifyBtn').textContent='🔊 Aktif'; 
            }
        }
        
        document.getElementById('statusDot').className = 'status-dot active';
        document.getElementById('statusText').textContent = 'İzleniyor...';
        addLog(`▶️ Başlatıldı: ${currentConfig.searchValue}`);
        await performScan();
        if (monitorInterval) clearInterval(monitorInterval);
        monitorInterval = setInterval(performScan, scanIntervalMinutes * 60000);
    }
    
    function stopMonitoring() {
        clearAllCountdowns();
        if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
        isMonitoring = false;
        previousTasksMap.clear(); isFirstScan = true;
        document.getElementById('statusDot').className = 'status-dot stopped';
        document.getElementById('statusText').textContent = 'Duruyor';
        addLog('⏹️ Durduruldu');
    }
    
    async function forceScan() {
        currentConfig.startHour = parseInt(document.getElementById('startHour').value)||0;
        currentConfig.endHour = parseInt(document.getElementById('endHour').value)||2;
        document.getElementById('timeRangeText').innerText = getTimeRangeText();
        await performScan();
    }
    
    createAppInterface();
    addLog('✅ v21.14 - Küçük kartlar + Güçlü alarm sesi');
    addLog('🔊 5 kısa + 2 uzun bip (square dalga)');
})();