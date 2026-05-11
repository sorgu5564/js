// ============================================
// v21.17 - URL hash'ten script yükleme + Login bekleme
// ============================================
(function() {
    'use strict';
    
    if (document.getElementById('smartgo-mobile-app')) return;
    
    // URL hash kontrolü
    var hash = window.location.hash;
    if (hash && hash.indexOf('#__panel__=') === 0) {
        try {
            var encoded = hash.replace('#__panel__=', '');
            var decoded = decodeURIComponent(escape(atob(encoded)));
            if (decoded && decoded.length > 1000) {
                console.log('✅ APK panel scripti bulundu');
                history.replaceState(null, '', window.location.pathname + window.location.search);
                var s = document.createElement('script');
                s.textContent = decoded;
                s.id = 'smartgo-panel-apk';
                document.body.appendChild(s);
                return;
            }
        } catch(e) { console.warn('Hash decode:', e.message); }
    }
    
    // Normal login bekleme
    console.log('%c✈️ SmartGO v21.17 - Login bekleniyor...', 'color:#0066cc;font-size:16px');
    
    var started = false, timer = null;
    
    function getToken() {
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i), v = localStorage.getItem(k);
            if (v && v.indexOf('eyJ') === 0 && v.length > 100) return v;
        }
        return null;
    }
    
    function startPanel(token) {
        if (started) return;
        started = true;
        if (timer) clearInterval(timer);
        console.log('✅ Token bulundu! Panel başlatılıyor...');
        
        // ============ GLOBAL DEĞİŞKENLER ============
        var monitorInterval = null, countdownIntervals = [], isMonitoring = false;
        var hideCompletedTasks = true, notificationEnabled = false, scanIntervalMinutes = 5;
        var lastTaskCount = 0, previousTasksMap = new Map(), isFirstScan = true;
        var currentConfig = { searchValue: 'SAHIN', hub: 'SAW', startHour: 0, endHour: 2 };
        
        var airportDatabase = {
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
            return airportDatabase[code] ? code + ' (' + airportDatabase[code] + ')' : code;
        }
        
        function getAircraftTypeName(t) {
            var types = {
                'A321-200': 'Airbus A321-200', 'A321-251NX': 'Airbus A321neo',
                'A320-200': 'Airbus A320-200', 'A320-251N': 'Airbus A320neo',
                'B737-800': 'Boeing 737-800', 'B737-8': 'Boeing 737-8',
                'B738': 'Boeing 737-800', 'A21N': 'Airbus A321neo', 'A20N': 'Airbus A320neo',
                'A-320-186': 'Airbus A320-200', 'A321-251': 'Airbus A321neo'
            };
            return types[t] || t;
        }
        
        function formatDurationWithSeconds(sec) {
            if (sec === null || sec === undefined || isNaN(sec) || sec <= 0) return '0 saniye';
            sec = Math.floor(sec);
            var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
            var r = '';
            if (h > 0) r += h + ' saat ';
            if (m > 0) r += m + ' dakika ';
            if (s > 0 || r === '') r += s + ' saniye';
            return r.trim();
        }
        
        function addThreeHoursToTime(t) {
            if (!t || t === '-' || t === 'null') return null;
            var m = t.replace(/\(.*?\)/g, '').trim().match(/(\d{1,2}):(\d{2})/);
            if (!m) return null;
            var h = parseInt(m[1]);
            return { display: String(h).padStart(2,'0') + ':' + m[2] + ' (' + String((h+3)%24).padStart(2,'0') + ':' + m[2] + ')' };
        }
        
        function formatDateTimeWithPlus3(d) {
            if (!d) return null;
            try {
                var dt = new Date(d);
                if (isNaN(dt.getTime())) return d;
                var hh = String(dt.getHours()).padStart(2,'0'), mm = String(dt.getMinutes()).padStart(2,'0');
                return String(dt.getDate()).padStart(2,'0') + '.' + String(dt.getMonth()+1).padStart(2,'0') + '.' + dt.getFullYear() + ' ' + hh + ':' + mm + ' (' + String((dt.getHours()+3)%24).padStart(2,'0') + ':' + mm + ')';
            } catch(e) { return d; }
        }
        
        function formatDateTime(d) {
            if (!d) return null;
            try { var dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleString('tr-TR'); } catch(e) { return d; }
        }
        
        function getSharePointProfileUrl(code) {
            return code ? 'https://flypgs.sharepoint.com/sites/pin#/tr/Profile/' + encodeURIComponent(code) : '#';
        }
        
        function getCountdownTarget(flight) {
            var now = new Date(), result = { type: null, targetTime: null, secondsLeft: Infinity, dangerLevel: 0 };
            var hasDeparted = !!(flight.Departure_ATDOffBlock && flight.Departure_ATDOffBlock !== '-');
            var hasArrived = !!(flight.Arrival_ATAOnBlock && flight.Arrival_ATAOnBlock !== '-');
            var arrTarget = null, arrSeconds = null, depTarget = null, depSeconds = null;
            
            if (!hasArrived && flight.Arrival_STA && flight.Arrival_STA !== '-') {
                try {
                    var p = flight.Arrival_STA.split(':');
                    var d = new Date();
                    d.setHours((parseInt(p[0])+3)%24, parseInt(p[1]), 0, 0);
                    if (d <= now) d.setDate(d.getDate()+1);
                    arrTarget = d; arrSeconds = Math.floor((d - now) / 1000);
                } catch(e) {}
            }
            
            if (!hasDeparted && flight.Departure_STD && flight.Departure_STD !== '-') {
                try {
                    var p = flight.Departure_STD.split(':');
                    var d = new Date();
                    d.setHours((parseInt(p[0])+3)%24, parseInt(p[1]), 0, 0);
                    if (d <= now) d.setDate(d.getDate()+1);
                    depTarget = d; depSeconds = Math.floor((d - now) / 1000);
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
                var mins = Math.floor(result.secondsLeft / 60);
                if (mins <= 5) result.dangerLevel = 3;
                else if (mins <= 15) result.dangerLevel = 2;
                else if (mins <= 30) result.dangerLevel = 1;
            }
            return result;
        }
        
        function getFlightAwareButton(reg) {
            if (!reg || reg === '-' || reg === 'null') return '';
            return '<a href="https://tr.flightaware.com/live/flight/' + reg.replace(/-/g,'') + '" target="_blank" class="track-btn track-btn-fa">✈️ FlightAware</a>';
        }
        
        function getFlightRadar24Button(reg) {
            if (!reg || reg === '-' || reg === 'null') return '';
            return '<a href="https://www.flightradar24.com/data/aircraft/' + reg.replace(/-/g,'') + '" target="_blank" class="track-btn track-btn-fr24">📡 FlightRadar24</a>';
        }
        
        function playNotificationSound() {
            try {
                var ctx = new (window.AudioContext || window.webkitAudioContext)();
                function beep(f, d, t, v) {
                    var o = ctx.createOscillator(), g = ctx.createGain();
                    o.connect(g); g.connect(ctx.destination);
                    o.type = 'square';
                    o.frequency.setValueAtTime(f, ctx.currentTime + t);
                    g.gain.setValueAtTime(v || 0.7, ctx.currentTime + t);
                    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + d);
                    o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d);
                }
                for (var i = 0; i < 5; i++) beep(880, 0.15, i * 0.15, 0.8);
                setTimeout(function() { for (var i = 0; i < 2; i++) beep(660, 0.3, i * 0.35, 0.7); }, 800);
            } catch(e) {}
        }
        
        async function requestNotificationPermission() {
            if (!('Notification' in window)) return false;
            if (Notification.permission === 'granted') return true;
            if (Notification.permission === 'denied') return false;
            try {
                var p = await Notification.requestPermission();
                if (p === 'granted') {
                    new Notification('✅ Bildirimler Aktif', {
                        body: 'Yeni görev atamaları size bildirilecek!',
                        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%231a5bbf"/%3E%3Ctext x="50" y="65" font-size="50" text-anchor="middle" fill="white"%3E✈️%3C/text%3E%3C/svg%3E'
                    });
                    playNotificationSound();
                }
                return p === 'granted';
            } catch(e) { return false; }
        }
        
        function checkNewTasksAndNotify(tasks, sv) {
            if (isFirstScan) {
                var m = new Map();
                tasks.forEach(function(t) {
                    var c = t.assignedEmployeeCode || t.assignedEmployeeName || '?';
                    var l = String(t.legIsn || t.taskCode || '?');
                    if (!m.has(c)) m.set(c, new Set());
                    m.get(c).add(l);
                });
                previousTasksMap = m; isFirstScan = false; return 0;
            }
            var cm = new Map();
            tasks.forEach(function(t) {
                var c = t.assignedEmployeeCode || t.assignedEmployeeName || '?';
                var l = String(t.legIsn || t.taskCode || '?');
                if (!cm.has(c)) cm.set(c, new Set());
                cm.get(c).add(l);
            });
            var found = [];
            cm.forEach(function(ls, c) {
                if (previousTasksMap.has(c)) {
                    var old = previousTasksMap.get(c);
                    ls.forEach(function(l) {
                        if (!old.has(l)) {
                            var t = tasks.find(function(x) { return String(x.legIsn || x.taskCode) === l && (x.assignedEmployeeCode === c || x.assignedEmployeeName === c); });
                            if (t) found.push({ code: c, name: t.assignedEmployeeName || c, legIsn: l, taskName: t.taskName || '?', flightNo: t.flightNo || '?' });
                        }
                    });
                }
            });
            if (found.length > 0) {
                playNotificationSound();
                found.forEach(function(t, i) {
                    setTimeout(function() {
                        try {
                            if (Notification.permission === 'granted') {
                                new Notification('🆕 Yeni Görev: ' + t.name, {
                                    body: t.taskName + '\nUçuş: ' + t.flightNo + '\nLeg: ' + t.legIsn,
                                    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%2328a745"/%3E%3Ctext x="50" y="65" font-size="50" text-anchor="middle" fill="white"%3E🆕%3C/text%3E%3C/svg%3E',
                                    tag: 'new-' + t.legIsn
                                });
                            }
                            addLog('🆕 YENİ GÖREV: ' + t.name + ' → ' + t.taskName + ' (' + t.flightNo + ')', true);
                        } catch(e) {}
                    }, i * 500);
                });
                setTimeout(function() { playNotificationSound(); }, 800);
            }
            previousTasksMap = cm;
            return found.length;
        }
        
        // API
        async function fetchFlights() {
            var now = new Date();
            var r = await fetch('https://smartgo.flypgs.com/api/flight/getFlightsAndWFCFlights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ hub: currentConfig.hub, search: { type: 2, start: new Date(now.getTime() + currentConfig.startHour * 3600000).toISOString(), end: new Date(now.getTime() + currentConfig.endHour * 3600000).toISOString(), intervalStart: currentConfig.startHour, intervalEnd: currentConfig.endHour }, fromserver: true })
            });
            var d = await r.json();
            return d.result || [];
        }
        
        async function fetchTasksForLeg(leg) {
            try {
                var r = await fetch('https://smartgo.flypgs.com/api/flight-task/get-tasks', {
                    method: 'POST',
                    headers: { 'accept': 'application/json', 'authorization': 'Bearer ' + token, 'content-type': 'application/json' },
                    body: JSON.stringify({ legIsn: parseInt(leg), hub: currentConfig.hub })
                });
                var d = await r.json();
                return Array.isArray(d) ? d : (d.result || d.data || []);
            } catch(e) { return []; }
        }
        
        async function fetchLoadsheet(leg) {
            try {
                var r = await fetch('https://smartgo.flypgs.com/api/loadsheet/getloadsheet/' + leg, {
                    method: 'GET', headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
                });
                if (!r.ok) return null;
                var d = await r.json();
                return (d && d.isSucceeded && d.result && d.result.length > 0) ? d.result[0] : null;
            } catch(e) { return null; }
        }
        
        async function fetchLDM(leg) {
            try {
                var r = await fetch('https://smartgo.flypgs.com/api/movementMessages/getLdmMessage/' + leg, {
                    method: 'GET', headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
                });
                if (!r.ok) return null;
                var d = await r.json();
                if (d && d.ldmMessage) {
                    return { raw: d.ldmMessage.ldmMessage || d.ldmMessage, isLDM: true };
                }
                return null;
            } catch(e) { return null; }
        }
        
        function isValidValue(v) {
            return !(v === null || v === undefined || v === '' || v === '-' || v === 'null' || v === 'undefined');
        }
        
        var statusLabels = { 0: 'Bilgi Yok', 1: 'Frekans Gönderildi', 2: 'İniş Yaptı', 3: 'Kapı Kapandı', 4: 'Havalandı', 5: 'Kalkış Yaptı' };
        var taskStatusLabels = { 'Waiting': 'Bekliyor', 'Started': 'Başladı', 'Accepted': 'Kabul Edildi', 'Finished': 'Tamamlandı', 'Rejected': 'Reddedildi' };
        
        function getTimeRangeText() {
            var s = currentConfig.startHour === 0 ? 'Şu an' : (currentConfig.startHour > 0 ? currentConfig.startHour + ' saat sonra' : Math.abs(currentConfig.startHour) + ' saat önce');
            var e = currentConfig.endHour === 0 ? 'Şu an' : (currentConfig.endHour > 0 ? currentConfig.endHour + ' saat sonra' : Math.abs(currentConfig.endHour) + ' saat önce');
            return s + ' - ' + e;
        }
        
        function getLDMHtml(data, type) {
            if (!data || !data.raw) return '';
            var t = String(data.raw).replace(/\\n/g, '\n').replace(/;/g, ';\n').replace(/\.([A-Z]{2,3})/g, '\n.$1').replace(/([A-Z]{2,6})\//g, '\n$1/');
            var emoji = type === 'dep' ? '🛫' : '🛬';
            var label = type === 'dep' ? 'KALKIŞ' : 'VARIŞ';
            var bg = type === 'dep' ? '#d1ecf1' : '#d4edda';
            var bc = type === 'dep' ? '#0c5460' : '#155724';
            return '<div style="background:' + bg + ';border-radius:10px;padding:10px;margin-top:10px;border-left:4px solid ' + bc + '"><div style="font-weight:700;font-size:12px;color:' + bc + ';margin-bottom:6px">' + emoji + ' ' + label + ' LDM</div><pre style="background:#1e1e2e;color:#a0ffa0;padding:8px;border-radius:6px;font-family:monospace;font-size:9px;white-space:pre-wrap;word-break:break-all;max-height:150px;overflow-y:auto;margin:0;line-height:1.3">' + escapeHtml(t) + '</pre></div>';
        }
        
        function getLoadsheetHtml(data, type) {
            if (!data) return '';
            if (data.isLDM) return getLDMHtml(data, type);
            
            var emoji = type === 'dep' ? '🛫' : '🛬';
            var label = type === 'dep' ? 'KALKIŞ' : 'VARIŞ';
            var bg = type === 'dep' ? '#d1ecf1' : '#d4edda';
            var bc = type === 'dep' ? '#0c5460' : '#155724';
            var info = data.flightInfo || {};
            var loadInfo = (data.loadInCompartment && data.loadInCompartment.destinations) ? data.loadInCompartment.destinations[0] : {};
            var passenger = (data.passenger && data.passenger.destinations) ? data.passenger.destinations[0] : {};
            var balance = data.balanceAndSeatingCondition || {};
            var ldmRaw = (data.loadMessage && data.loadMessage.ldm) ? data.loadMessage.ldm : '';
            var siRaw = (data.loadMessage && data.loadMessage.si) ? data.loadMessage.si : '';
            
            return '<div style="background:' + bg + ';border-radius:10px;padding:10px;margin-top:10px;border-left:4px solid ' + bc + '">' +
                '<div style="font-weight:700;font-size:12px;color:' + bc + ';margin-bottom:8px">' + emoji + ' ' + label + ' LOADSHEET</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:4px;margin-bottom:6px">' +
                '<div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">✈️ Uçuş</div><div style="font-weight:700;font-size:11px;color:#1a5bbf">' + (info.flightNo || '-') + '</div></div>' +
                '<div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">🆔 Tescil</div><div style="font-weight:700;font-size:11px">' + (info.acReg || '-') + '</div></div>' +
                '<div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">📋 Tip</div><div style="font-weight:700;font-size:11px">' + (info.acType || '-') + '</div></div>' +
                '<div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">🛫→🛬</div><div style="font-weight:700;font-size:10px">' + (info.departurePort || '-') + '→' + (info.arrivalPort || '-') + '</div></div>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:4px;margin-bottom:6px">' +
                '<div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">👥 Yolcu</div><div style="font-weight:700;font-size:12px;color:#1a5bbf">' + (data.totalPassenger || '-') + '</div></div>' +
                '<div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">💺 Dağılım</div><div style="font-weight:700;font-size:9px">' + (passenger.passengerDistribution || data.passengerCabinBagDistribution || '-') + '</div></div>' +
                '<div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">⚖️ Yolcu Ağ.</div><div style="font-weight:700;font-size:11px">' + ((data.passenger && data.passenger.weight) ? data.passenger.weight : '-') + ' ' + (data.weightUnitType || 'KG') + '</div></div>' +
                '<div style="background:white;border-radius:6px;padding:6px;text-align:center"><div style="font-size:7px;color:#6c757d">🧳 Bagaj</div><div style="font-weight:700;font-size:10px">' + (loadInfo.baggageCount || 0) + ' ad/' + (loadInfo.baggageWeight || 0) + ' ' + (data.weightUnitType || 'KG') + '</div></div>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:4px;margin-bottom:6px">' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">DOW</div><div style="font-weight:700;font-size:10px">' + (data.dow || 0) + '</div></div>' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">Trafik</div><div style="font-weight:700;font-size:10px">' + (data.totalTrafficLoad || 0) + '</div></div>' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">TOF</div><div style="font-weight:700;font-size:10px">' + (data.takeoffFuel || 0) + '</div></div>' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">Trip</div><div style="font-weight:700;font-size:10px">' + (data.tripFuel || 0) + '</div></div>' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">ZFW</div><div style="font-weight:700;font-size:10px">' + ((data.zeroFuelWeight && data.zeroFuelWeight.actual) ? data.zeroFuelWeight.actual : 0) + '</div></div>' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">TOW</div><div style="font-weight:700;font-size:10px">' + ((data.takeOffWeight && data.takeOffWeight.actual) ? data.takeOffWeight.actual : 0) + '</div></div>' +
                '</div>' +
                '<div style="background:white;border-radius:6px;padding:6px;margin-bottom:6px"><div style="font-size:7px;color:#6c757d;margin-bottom:2px">📦 KOMPARTMAN</div><div style="font-weight:600;font-size:10px;font-family:monospace">' + (loadInfo.holdDistribution || data.loadInCompartmentDistribution || '-') + '</div><div style="font-size:8px;color:#6c757d;margin-top:1px">Toplam: ' + (data.totalHoldWeight || 0) + ' ' + (data.weightUnitType || 'KG') + '</div></div>' +
                '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:6px">' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">DOI</div><div style="font-weight:700;font-size:9px">' + (balance.doi || 0) + '</div></div>' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">LIZFW</div><div style="font-weight:700;font-size:9px">' + (balance.lizfw || 0) + '</div></div>' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">MACZFW</div><div style="font-weight:700;font-size:9px">' + (balance.maczfw || 0) + '%</div></div>' +
                '<div style="background:white;border-radius:4px;padding:4px;text-align:center"><div style="font-size:6px;color:#6c757d">MACTOW</div><div style="font-weight:700;font-size:9px">' + (balance.mactow || 0) + '%</div></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;font-size:8px;color:#6c757d;flex-wrap:wrap;gap:3px;margin-bottom:6px"><span>✍️ ' + (data.preparedBy || '-') + '</span><span>✅ ' + (data.checkedBy || '-') + '</span><span>📋 ' + (data.approvedBy || (data.loadSheetStatus && data.loadSheetStatus.approvedBy) || '-') + '</span></div>' +
                (ldmRaw ? '<div style="background:#1e1e2e;border-radius:6px;padding:8px;margin-top:4px"><div style="font-size:9px;color:#a0ffa0;font-weight:700">📄 LDM</div><pre style="color:#a0ffa0;font-family:monospace;font-size:8px;white-space:pre-wrap;word-break:break-all;max-height:150px;overflow-y:auto;margin:0;line-height:1.3">' + escapeHtml(ldmRaw) + '</pre></div>' : '') +
                (siRaw ? '<div style="background:#2e1e1e;border-radius:6px;padding:8px;margin-top:3px"><div style="font-size:9px;color:#ffa0a0;font-weight:700">📋 SI</div><pre style="color:#ffa0a0;font-family:monospace;font-size:8px;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow-y:auto;margin:0;line-height:1.3">' + escapeHtml(siRaw) + '</pre></div>' : '') +
                '</div>';
        }
        
        function escapeHtml(s) {
            if (!s) return '';
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        
        function clearAllCountdowns() { countdownIntervals.forEach(function(id) { clearInterval(id); }); countdownIntervals = []; }
        
        function addLog(msg, isNew) {
            var area = document.getElementById('logArea'); if (!area) return;
            var div = document.createElement('div');
            div.className = 'log-entry' + (isNew ? ' new-task' : '');
            div.innerHTML = '[' + new Date().toLocaleTimeString('tr-TR') + '] ' + msg;
            area.appendChild(div); area.scrollTop = area.scrollHeight;
            while (area.children.length > 50) area.removeChild(area.firstChild);
        }
        
        function updateStats(f, t, p, y, a) {
            var ids = ['statFlights', 'statTasks', 'statPersonel', 'statYKB', 'statActive'];
            var vals = [f, t, p, y, a];
            ids.forEach(function(id, i) { var el = document.getElementById(id); if (el) el.textContent = vals[i]; });
        }
        
        // ============ RENDER ============
        function renderContent(flights, tasks, loadsheetMap, allTasksMap) {
            clearAllCountdowns();
            var container = document.getElementById('contentArea'); if (!container) return;
            
            var flightsWithCountdown = flights.map(function(flight) {
                var countdown = getCountdownTarget(flight);
                var flightNo = flight.Departure_FlightNo || flight.Arrival_FlightNo || '??';
                var flightTasks = tasks.filter(function(t) { return t.flightNo === flightNo; });
                var allFlightTasks = (allTasksMap && allTasksMap.get(flightNo)) ? allTasksMap.get(flightNo) : flightTasks;
                return { flight: flight, countdown: countdown, flightNo: flightNo, flightTasks: flightTasks, allFlightTasks: allFlightTasks };
            });
            
            flightsWithCountdown.sort(function(a, b) {
                var secA = (a.countdown.secondsLeft !== null && a.countdown.secondsLeft !== Infinity) ? a.countdown.secondsLeft : 999999;
                var secB = (b.countdown.secondsLeft !== null && b.countdown.secondsLeft !== Infinity) ? b.countdown.secondsLeft : 999999;
                return secA - secB;
            });
            
            var html = '';
            var searchValue = (currentConfig.searchValue || 'SAHIN').toLowerCase();
            
            for (var i = 0; i < flightsWithCountdown.length; i++) {
                var item = flightsWithCountdown[i];
                var flight = item.flight, countdown = item.countdown, flightNo = item.flightNo;
                var flightTasks = item.flightTasks, allFlightTasks = item.allFlightTasks;
                
                var dangerClass = countdown.dangerLevel > 0 ? ' danger-level-' + countdown.dangerLevel : '';
                var statusIcon = countdown.dangerLevel === 3 ? '🔴 ' : (countdown.dangerLevel === 2 ? '🟠 ' : (countdown.dangerLevel === 1 ? '🟡 ' : ''));
                
                var infoItems = [];
                if (isValidValue(flight.Departure_Port)) {
                    var d = getAirportName(flight.Departure_Port);
                    if (isValidValue(flight.Departure_ParkPosition)) d += ' | 🅿️ ' + flight.Departure_ParkPosition;
                    if (isValidValue(flight.Departure_Gate)) d += ' | 🚪 ' + flight.Departure_Gate;
                    infoItems.push({ label: '🛫 KALKIŞ', value: d });
                }
                if (isValidValue(flight.Arrival_Port)) {
                    var d = getAirportName(flight.Arrival_Port);
                    if (isValidValue(flight.Arrival_ParkPosition)) d += ' | 🅿️ ' + flight.Arrival_ParkPosition;
                    if (isValidValue(flight.Arrival_Gate)) d += ' | 🚪 ' + flight.Arrival_Gate;
                    if (isValidValue(flight.Arrival_Carosel)) d += ' | 🎒 ' + flight.Arrival_Carosel;
                    infoItems.push({ label: '🛬 VARIŞ', value: d });
                }
                if (isValidValue(flight.RegSerial)) {
                    var t = getAircraftTypeName(flight.Departure_ACType || flight.Arrival_ACType);
                    infoItems.push({ label: '✈️ UÇAK', value: flight.RegSerial + (t ? ' (' + t + ')' : ''), className: 'aircraft' });
                }
                if (isValidValue(flight.Departure_CargoPiece) && isValidValue(flight.Departure_CargoKilo)) {
                    var c = flight.Departure_CargoPiece + ' adet / ' + flight.Departure_CargoKilo + ' kg';
                    if (isValidValue(flight.Departure_CargoRemark)) c += ' (' + flight.Departure_CargoRemark + ')';
                    infoItems.push({ label: '📦 KARGO', value: c, className: 'cargo' });
                }
                if (isValidValue(flight.Departure_STD)) {
                    var tt = addThreeHoursToTime(flight.Departure_STD);
                    infoItems.push({ label: '📅 PLAN. KALKIŞ', value: tt ? tt.display : flight.Departure_STD });
                }
                if (isValidValue(flight.Arrival_STA)) {
                    var tt = addThreeHoursToTime(flight.Arrival_STA);
                    infoItems.push({ label: '📅 PLAN. VARIŞ', value: tt ? tt.display : flight.Arrival_STA });
                }
                if (isValidValue(flight.Departure_ATDOffBlock)) infoItems.push({ label: '✅ GERÇEK KALKIŞ', value: formatDateTimeWithPlus3(flight.Departure_ATDOffBlock) });
                if (isValidValue(flight.Arrival_ATAOnBlock)) infoItems.push({ label: '✅ GERÇEK VARIŞ', value: formatDateTimeWithPlus3(flight.Arrival_ATAOnBlock) });
                if (isValidValue(flight.Departure_Note)) infoItems.push({ label: '📝 NOT', value: escapeHtml(flight.Departure_Note) });
                
                var countdownHtml = '';
                if (countdown.type && countdown.targetTime && countdown.secondsLeft > 0) {
                    var id = 'cd-' + flightNo.replace(/[^a-zA-Z0-9]/g, '-');
                    var cls = countdown.type === 'departure' ? 'countdown-departure' : 'countdown-arrival';
                    var emoji = countdown.type === 'departure' ? '🛫' : '🛬';
                    var label = countdown.type === 'departure' ? 'Kalkışa' : 'Varışa';
                    countdownHtml = '<div id="' + id + '" class="countdown-display ' + cls + '" data-target="' + countdown.targetTime.toISOString() + '">' + emoji + ' ' + label + ' son: <span class="countdown-timer">' + formatDurationWithSeconds(countdown.secondsLeft) + '</span></div>';
                }
                
                var loadsheetHtml = '';
                if (flight.Departure_LegIsn && loadsheetMap.has(flight.Departure_LegIsn)) loadsheetHtml += getLoadsheetHtml(loadsheetMap.get(flight.Departure_LegIsn), 'dep');
                if (flight.Arrival_LegIsn && loadsheetMap.has(flight.Arrival_LegIsn)) loadsheetHtml += getLoadsheetHtml(loadsheetMap.get(flight.Arrival_LegIsn), 'arr');
                
                var trackButtonsHtml = '';
                if (isValidValue(flight.RegSerial)) {
                    trackButtonsHtml = '<div class="track-buttons">' + getFlightAwareButton(flight.RegSerial) + getFlightRadar24Button(flight.RegSerial) + '</div>';
                }
                
                var personelMap = new Map();
                for (var j = 0; j < allFlightTasks.length; j++) {
                    var task = allFlightTasks[j];
                    var key = task.assignedEmployeeName || 'Bilinmeyen';
                    if (!personelMap.has(key)) personelMap.set(key, { tasks: [], code: task.assignedEmployeeCode || null, phone: task.assignedEmployeeMobilePhone || null });
                    personelMap.get(key).tasks.push(task);
                }
                
                var tasksHtml = '';
                var entries = Array.from(personelMap.entries());
                for (var k = 0; k < entries.length; k++) {
                    var name = entries[k][0], data = entries[k][1];
                    var isYKB = data.tasks.some(function(t) { return t.taskName && t.taskName.toLowerCase().indexOf('ykb') !== -1; });
                    var phoneLink = data.phone ? 'https://wa.me/' + data.phone.replace(/\D/g, '') : null;
                    var codeHtml = data.code ? '<a href="' + getSharePointProfileUrl(data.code) + '" target="_blank" class="personnel-code-link">🔑 ' + escapeHtml(data.code) + '</a>' : '';
                    var isSearched = name.toLowerCase().indexOf(searchValue) !== -1 || (data.code && data.code.toLowerCase().indexOf(searchValue) !== -1);
                    var highlightClass = isSearched ? ' personnel-highlight' : '';
                    var searchedBadge = isSearched ? ' <span class="searched-badge">🎯</span>' : '';
                    var titleHtml = '<span class="personnel-mini-name">👤 ' + escapeHtml(name) + '</span> ' + codeHtml + searchedBadge;
                    if (isYKB) titleHtml += ' <span style="background:#ffc107;color:#333;padding:1px 6px;border-radius:15px;font-size:8px;font-weight:700">⭐ YKB</span>';
                    if (phoneLink) titleHtml += ' <a href="' + phoneLink + '" target="_blank" style="color:#25D366;text-decoration:none;font-weight:500;font-size:9px">📱</a>';
                    
                    var taskCards = data.tasks.map(function(task) {
                        var sc = task.taskStatusText || 'Waiting';
                        return '<div class="personnel-mini-task"><div class="personnel-mini-task-label">📋 ' + escapeHtml(task.taskName || 'Görev') + ' <span class="personnel-mini-status status-' + sc + '">' + (taskStatusLabels[sc] || sc) + '</span></div><div class="personnel-mini-task-value">' + escapeHtml(task.taskCode || '-') + ' | ' + (formatDateTime(task.scheduledStartTime) || '-') + ' → ' + (formatDateTime(task.scheduledEndTime) || '-') + '</div></div>';
                    }).join('');
                    
                    tasksHtml += '<div class="personnel-mini-card' + highlightClass + '"><div class="personnel-mini-header"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' + titleHtml + '</div><span style="font-size:9px;color:#6c757d">📋 ' + data.tasks.length + '</span></div><div class="personnel-mini-body">' + taskCards + '</div></div>';
                }
                
                var totalPersonnel = personelMap.size;
                html += '<div class="flight-card' + dangerClass + '"><div class="flight-card-header"><div class="flight-title"><div class="flight-number">' + statusIcon + '✈️ ' + escapeHtml(flightNo) + ' <span class="flight-status">' + (statusLabels[flight.Status] || '?') + '</span>' + (isValidValue(flight.RegSerial) ? ' <span class="flight-reg">' + flight.RegSerial + '</span>' : '') + '</div><span class="flight-badge">👥 ' + totalPersonnel + ' | 📋 ' + allFlightTasks.length + '</span></div></div><div class="flight-card-body">' + countdownHtml + '<div class="info-grid">' + infoItems.map(function(item) { return '<div class="info-item"><div class="info-label">' + item.label + '</div><div class="info-value ' + (item.className || '') + '">' + item.value + '</div></div>'; }).join('') + '</div>' + trackButtonsHtml + loadsheetHtml + '<div class="section-title">👥 PERSONEL (' + totalPersonnel + ' kişi)</div>' + tasksHtml + '</div></div>';
            }
            
            container.innerHTML = html || '<div class="loading"><h3>📭 Uçuş bulunamadı</h3></div>';
            
            document.querySelectorAll('.countdown-display').forEach(function(el) {
                var target = new Date(el.dataset.target);
                var timerEl = el.querySelector('.countdown-timer');
                var flightCard = el.closest('.flight-card');
                var update = function() {
                    var secs = Math.floor((target - new Date()) / 1000);
                    if (secs <= 0) {
                        timerEl.textContent = '0 saniye';
                        el.classList.add('countdown-urgent');
                        if (flightCard) flightCard.classList.add('danger-level-3');
                        return;
                    }
                    timerEl.textContent = formatDurationWithSeconds(secs);
                    var mins = Math.floor(secs / 60);
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
            addLog('🔍 Taranıyor...');
            try {
                var flights = await fetchFlights();
                if (!flights.length) { addLog('⚠️ Uçuş bulunamadı'); return; }
                
                var legMap = new Map();
                flights.forEach(function(f) {
                    var no = f.Departure_FlightNo || f.Arrival_FlightNo;
                    if (f.Departure_LegIsn && f.Departure_LegIsn !== '-') legMap.set(f.Departure_LegIsn, { no: no, flight: f });
                    if (f.Arrival_LegIsn && f.Arrival_LegIsn !== '-') legMap.set(f.Arrival_LegIsn, { no: no, flight: f });
                });
                
                var legs = Array.from(legMap.keys());
                var allTasks = [], loadsheetMap = new Map(), allTasksByFlight = new Map();
                
                for (var i = 0; i < legs.length; i += 2) {
                    var batch = legs.slice(i, i + 2);
                    try {
                        var results = await Promise.all([
                            Promise.all(batch.map(function(l) { return fetchTasksForLeg(l).catch(function() { return []; }); })),
                            Promise.all(batch.map(function(l) { return fetchLoadsheet(l).catch(function() { return null; }); }))
                        ]);
                        var taskRes = results[0], loadsheetRes = results[1];
                        batch.forEach(function(leg, j) {
                            var flightNo = legMap.get(leg) ? legMap.get(leg).no : '-';
                            if (taskRes[j] && taskRes[j].length > 0) {
                                taskRes[j].forEach(function(t) {
                                    var twf = Object.assign({}, t, { flightNo: flightNo });
                                    allTasks.push(twf);
                                    if (!allTasksByFlight.has(flightNo)) allTasksByFlight.set(flightNo, []);
                                    allTasksByFlight.get(flightNo).push(twf);
                                });
                            }
                            if (loadsheetRes[j]) loadsheetMap.set(leg, loadsheetRes[j]);
                            else fetchLDM(leg).then(function(ldm) { if (ldm) loadsheetMap.set(leg, ldm); });
                        });
                    } catch(e) {}
                }
                
                var sv = currentConfig.searchValue || 'SAHIN';
                var filtered = allTasks.filter(function(t) {
                    return (t.assignedEmployeeName || '').toLowerCase().indexOf(sv.toLowerCase()) !== -1 || (t.assignedEmployeeCode || '').toLowerCase().indexOf(sv.toLowerCase()) !== -1;
                });
                var display = hideCompletedTasks ? filtered.filter(function(t) { return t.taskStatusText !== 'Finished'; }) : filtered;
                
                var newTaskCount = checkNewTasksAndNotify(display, sv);
                if (newTaskCount > 0) addLog('🆕 ' + newTaskCount + ' yeni görev! 🔊', true);
                
                var flightNos = new Set(display.map(function(t) { return t.flightNo; }));
                var filteredFlights = flights.filter(function(f) { return flightNos.has(f.Departure_FlightNo || f.Arrival_FlightNo); });
                
                var personelSet = new Set(), ykb = 0;
                allTasks.forEach(function(t) {
                    if (isValidValue(t.assignedEmployeeName)) personelSet.add(t.assignedEmployeeName);
                    if (t.taskName && t.taskName.toLowerCase().indexOf('ykb') !== -1) ykb++;
                });
                
                renderContent(filteredFlights, display, loadsheetMap, allTasksByFlight);
                updateStats(filteredFlights.length, allTasks.length, personelSet.size, ykb, display.length);
                addLog('✅ ' + filteredFlights.length + ' uçuş, ' + display.length + ' görev');
            } catch(e) { addLog('❌ ' + e.message); }
        }
        
        async function startMonitoring() {
            if (isMonitoring) return;
            isMonitoring = true; previousTasksMap.clear(); isFirstScan = true;
            currentConfig.hub = document.getElementById('hubSelect').value;
            currentConfig.searchValue = document.getElementById('searchInput').value;
            currentConfig.startHour = parseInt(document.getElementById('startHour').value) || 0;
            currentConfig.endHour = parseInt(document.getElementById('endHour').value) || 2;
            hideCompletedTasks = document.getElementById('hideCompletedCheckbox').checked;
            scanIntervalMinutes = parseInt(document.getElementById('intervalSelect').value);
            
            if (!notificationEnabled && Notification.permission === 'default') {
                notificationEnabled = await requestNotificationPermission();
                if (notificationEnabled) {
                    document.getElementById('notifyBtn').style.background = '#28a745';
                    document.getElementById('notifyBtn').style.color = 'white';
                    document.getElementById('notifyBtn').textContent = '🔊 Aktif';
                }
            }
            
            document.getElementById('statusDot').className = 'status-dot active';
            document.getElementById('statusText').textContent = 'İzleniyor...';
            addLog('▶️ Başlatıldı: ' + currentConfig.searchValue);
            await performScan();
            if (monitorInterval) clearInterval(monitorInterval);
            monitorInterval = setInterval(performScan, scanIntervalMinutes * 60000);
        }
        
        function stopMonitoring() {
            clearAllCountdowns();
            if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
            isMonitoring = false; previousTasksMap.clear(); isFirstScan = true;
            document.getElementById('statusDot').className = 'status-dot stopped';
            document.getElementById('statusText').textContent = 'Duruyor';
            addLog('⏹️ Durduruldu');
        }
        
        async function forceScan() {
            currentConfig.startHour = parseInt(document.getElementById('startHour').value) || 0;
            currentConfig.endHour = parseInt(document.getElementById('endHour').value) || 2;
            document.getElementById('timeRangeText').innerText = getTimeRangeText();
            await performScan();
        }
        
        // ============ ARAYÜZ OLUŞTUR ============
        var app = document.createElement('div');
        app.id = 'smartgo-mobile-app';
        app.innerHTML = '<style>*{margin:0;padding:0;box-sizing:border-box}#smartgo-mobile-app{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;background:#f0f2f5!important;color:#1a1a2e!important;z-index:2147483647!important;font-family:\'Segoe UI\',system-ui,sans-serif!important;overflow-y:auto!important;display:flex!important;flex-direction:column!important}.app-header{background:linear-gradient(135deg,#1a5bbf,#004e9e)!important;padding:10px 16px!important;position:sticky!important;top:0!important;z-index:100!important}.app-header h1{font-size:16px;color:#fff}.close-btn{position:absolute;top:10px;right:12px;background:rgba(255,255,255,.2);border:none;width:28px;height:28px;border-radius:50%;color:#fff;font-size:16px;cursor:pointer}.control-panel{background:#fff;padding:8px 12px;border-bottom:1px solid #e0e0e0}.control-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}.control-row:first-child{margin-top:0}.status-badge{display:flex;align-items:center;gap:6px;background:#e9ecef;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:500}.status-dot{width:8px;height:8px;border-radius:50%}.status-dot.active{background:#28a745;box-shadow:0 0 4px #28a745}.status-dot.stopped{background:#dc3545}.search-input,.hub-select,.interval-select{background:#f8f9fa;border:1px solid #dee2e6;padding:6px 10px;border-radius:20px;font-size:12px}.search-input{flex:1;min-width:120px}.time-range-group{display:flex;align-items:center;gap:4px;background:#f8f9fa;padding:3px 8px;border-radius:20px;border:1px solid #dee2e6}.time-input{width:45px;background:0 0;border:none;padding:4px 0;font-size:12px;text-align:center}.checkbox-label{display:flex;align-items:center;gap:6px;background:#e9ecef;padding:5px 10px;border-radius:20px;font-size:11px;cursor:pointer}.btn{padding:6px 14px;border-radius:20px;border:none;font-weight:600;font-size:11px;cursor:pointer;transition:.2s}.btn-primary{background:#1a5bbf;color:#fff}.btn-danger{background:#dc3545;color:#fff}.btn-success{background:#28a745;color:#fff}.btn-warning{background:#ffc107;color:#1a1a2e}.stats-grid{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:#fff}.stat-card{background:#f8f9fa;border-radius:10px;padding:6px 10px;text-align:center;flex:1;min-width:55px}.stat-number{font-size:18px;font-weight:700;color:#1a5bbf}.stat-label{font-size:8px;color:#6c757d}.content-area{flex:1;padding:12px;overflow-y:auto}.flight-card{background:#fff;border-radius:16px;margin-bottom:14px;border:2px solid #e9ecef;transition:all .5s}.flight-card.danger-level-1{border-color:#ffc107;box-shadow:0 0 10px rgba(255,193,7,.3)}.flight-card.danger-level-2{border-color:#fd7e14;box-shadow:0 0 15px rgba(253,126,20,.4);animation:pulse-orange 2s infinite}.flight-card.danger-level-3{border-color:#dc3545;box-shadow:0 0 20px rgba(220,53,69,.6);animation:pulse-red 1s infinite}@keyframes pulse-orange{50%{box-shadow:0 0 25px rgba(253,126,20,.7)}}@keyframes pulse-red{50%{box-shadow:0 0 30px rgba(220,53,69,.9)}}.flight-card-header{background:linear-gradient(135deg,#f8f9fa,#f1f3f5);padding:8px 12px}.flight-title{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px}.flight-number{font-size:15px;font-weight:700;color:#1a5bbf}.flight-card-body{padding:12px}.countdown-display{border-radius:12px;padding:10px 14px;margin:8px 0;text-align:center;font-weight:700;font-size:14px}.countdown-departure{background:linear-gradient(135deg,#d1ecf1,#bee5eb);color:#0c5460;border-left:4px solid #0c5460}.countdown-arrival{background:linear-gradient(135deg,#d4edda,#c3e6cb);color:#155724;border-left:4px solid #155724}.countdown-urgent{background:linear-gradient(135deg,#f8d7da,#f5c6cb)!important;color:#721c24!important;animation:pulse-bg 1s infinite}@keyframes pulse-bg{50%{opacity:.7}}.info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-bottom:12px}.info-item{background:#f8f9fa;border-radius:10px;padding:8px 10px;border-left:3px solid #1a5bbf}.info-label{font-size:8px;font-weight:600;color:#6c757d;text-transform:uppercase;margin-bottom:2px}.info-value{font-size:11px;font-weight:500}.info-value.cargo{color:#e67e22;font-weight:600}.personnel-code-link{display:inline-block;background:#1a5bbf;color:#fff!important;padding:2px 8px;border-radius:15px;font-size:9px;font-weight:700;font-family:monospace;text-decoration:none;cursor:pointer}.track-buttons{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.track-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;text-decoration:none;font-size:10px;font-weight:600;transition:all .2s;color:#fff}.track-btn-fa{background:linear-gradient(135deg,#1a5bbf,#004e9e)}.track-btn-fr24{background:linear-gradient(135deg,#ff6b35,#c73e1d)}.personnel-mini-card{background:#f8f9fa;border-radius:8px;margin-bottom:5px;overflow:hidden;font-size:10px}.personnel-mini-header{background:#e9ecef;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px}.personnel-mini-name{font-weight:700;font-size:11px}.personnel-mini-body{padding:6px 10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:4px}.personnel-mini-task{background:#fff;border-radius:6px;padding:4px 8px;font-size:9px;border-left:2px solid #1a5bbf}.personnel-mini-task-label{font-size:7px;color:#6c757d;text-transform:uppercase;margin-bottom:1px}.personnel-mini-task-value{font-size:9px;font-weight:500}.personnel-mini-status{padding:1px 6px;border-radius:20px;font-size:8px;font-weight:600}.personnel-highlight{border:2px solid #1a5bbf!important;box-shadow:0 0 8px rgba(26,91,191,.3)!important}.searched-badge{background:#1a5bbf;color:#fff;padding:1px 6px;border-radius:15px;font-size:8px;font-weight:700}.status-Waiting{background:#fff3cd;color:#856404}.status-Started{background:#d1ecf1;color:#0c5460}.status-Accepted{background:#d4edda;color:#155724}.status-Finished{background:#cce5ff;color:#004085}.status-Rejected{background:#f8d7da;color:#721c24}.log-area{background:#1e1e2e;padding:6px 12px;max-height:60px;overflow-y:auto;font-size:8px;font-family:monospace}.log-entry{padding:2px 0;color:#a0ffa0;border-bottom:1px solid #333}.log-entry.new-task{color:#ffc107;font-weight:bold}.loading{text-align:center;padding:30px;color:#6c757d}.section-title{font-size:13px;font-weight:700;margin:12px 0 8px;padding-left:8px;border-left:3px solid #1a5bbf}@media(max-width:600px){.info-grid{grid-template-columns:1fr}.personnel-mini-body{grid-template-columns:1fr}}</style>' +
        '<div class="app-header"><button class="close-btn" id="closeAppBtn">✕</button><h1>✈️ Pegasus SmartGO <small>v21.17</small></h1><div class="time-range"><span>🕐</span><span id="timeRangeText">' + getTimeRangeText() + '</span></div></div>' +
        '<div class="control-panel"><div class="control-row"><div class="status-badge"><span class="status-dot" id="statusDot"></span><span id="statusText">Duruyor</span></div><input id="searchInput" class="search-input" placeholder="Personel adı/kodu..." value="SAHIN"><select id="hubSelect" class="hub-select"><option value="SAW">SAW</option><option value="AYT">AYT</option><option value="ESB">ESB</option><option value="ADB">ADB</option><option value="DLM">DLM</option></select></div>' +
        '<div class="control-row"><div class="time-range-group"><span>📅</span><input id="startHour" class="time-input" value="0" type="number"><span>→</span><input id="endHour" class="time-input" value="2" type="number"><span>saat</span></div><select id="intervalSelect" class="interval-select"><option value="1">1 dk</option><option value="3">3 dk</option><option value="5" selected>5 dk</option><option value="10">10 dk</option><option value="30">30 dk</option></select><label class="checkbox-label"><input id="hideCompletedCheckbox" type="checkbox" checked><span>✅ Tamamlananları gizle</span></label><button id="notifyBtn" class="btn btn-warning">🔔</button><button id="startBtn" class="btn btn-primary">▶️ Başlat</button><button id="stopBtn" class="btn btn-danger">⏹️ Durdur</button><button id="refreshBtn" class="btn btn-success">🔄 Tara</button></div></div>' +
        '<div class="stats-grid"><div class="stat-card"><div class="stat-number" id="statFlights">0</div><div class="stat-label">Uçuş</div></div><div class="stat-card"><div class="stat-number" id="statTasks">0</div><div class="stat-label">Görev</div></div><div class="stat-card"><div class="stat-number" id="statPersonel">0</div><div class="stat-label">Personel</div></div><div class="stat-card"><div class="stat-number" id="statYKB">0</div><div class="stat-label">YKB</div></div><div class="stat-card"><div class="stat-number" id="statActive">0</div><div class="stat-label">Aktif</div></div></div>' +
        '<div class="content-area" id="contentArea"><div class="loading"><h3>✈️ SmartGO Takip</h3><p>Başlat\'a tıklayın</p></div></div><div class="log-area" id="logArea"><div class="log-entry">✅ v21.17 - APK + Login</div></div>';
        
        document.body.appendChild(app);
        
        document.getElementById('closeAppBtn').onclick = function() {
            clearAllCountdowns();
            if (monitorInterval) clearInterval(monitorInterval);
            previousTasksMap.clear(); isFirstScan = true;
            app.remove();
        };
        document.getElementById('startBtn').onclick = startMonitoring;
        document.getElementById('stopBtn').onclick = stopMonitoring;
        document.getElementById('refreshBtn').onclick = forceScan;
        document.getElementById('notifyBtn').onclick = async function() {
            notificationEnabled = await requestNotificationPermission();
            if (notificationEnabled) {
                document.getElementById('notifyBtn').style.background = '#28a745';
                document.getElementById('notifyBtn').style.color = 'white';
                document.getElementById('notifyBtn').textContent = '🔊 Aktif';
            }
        };
        
        ['startHour', 'endHour'].forEach(function(id) {
            document.getElementById(id).onchange = function(e) {
                var v = parseInt(e.target.value) || 0;
                if (id === 'startHour') currentConfig.startHour = v;
                else currentConfig.endHour = v;
                document.getElementById('timeRangeText').innerText = getTimeRangeText();
                if (isMonitoring) forceScan();
            };
        });
        
        document.getElementById('searchInput').onchange = function(e) {
            currentConfig.searchValue = e.target.value;
            previousTasksMap.clear(); isFirstScan = true;
            if (isMonitoring) forceScan();
        };
        document.getElementById('hubSelect').onchange = function(e) {
            currentConfig.hub = e.target.value;
            if (isMonitoring) forceScan();
        };
        document.getElementById('intervalSelect').onchange = function(e) {
            scanIntervalMinutes = parseInt(e.target.value);
            if (isMonitoring && monitorInterval) {
                clearInterval(monitorInterval);
                monitorInterval = setInterval(performScan, scanIntervalMinutes * 60000);
            }
        };
        document.getElementById('hideCompletedCheckbox').onchange = function(e) {
            hideCompletedTasks = e.target.checked;
            if (isMonitoring) forceScan();
        };
        
        addLog('✅ Panel hazır - Başlat\'a tıklayın');
    }
    
    // ============ BAŞLATMA KONTROLÜ ============
    var existingToken = getToken();
    if (existingToken) {
        setTimeout(function() { startPanel(existingToken); }, 500);
    } else {
        console.log('⏳ Token bekleniyor...');
        timer = setInterval(function() {
            var t = getToken();
            if (t && !started) startPanel(t);
        }, 2000);
        setTimeout(function() { if (timer && !started) clearInterval(timer); }, 600000);
    }
    
})();