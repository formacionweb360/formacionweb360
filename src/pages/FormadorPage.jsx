<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Registrar Asistencia - QR</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .container {
      background: white;
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
      overflow: hidden;
      animation: fadeIn 0.5s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px;
      text-align: center;
      color: white;
    }
    
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    
    .header p {
      margin-top: 8px;
      opacity: 0.9;
      font-size: 14px;
    }
    
    .content {
      padding: 30px;
    }
    
    .control-buttons {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .btn {
      flex: 1;
      padding: 14px 24px;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
    
    .btn-primary:active {
      transform: translateY(0);
    }
    
    .btn-danger {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
      display: none;
    }
    
    .btn-danger:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(245, 87, 108, 0.5);
    }
    
    #diaSelector {
      display: none;
      margin-bottom: 24px;
    }
    
    .dia-label {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
      display: block;
    }
    
    .dia-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    
    .dia-btn {
      padding: 12px;
      border: 2px solid #e0e0e0;
      background: white;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      color: #666;
    }
    
    .dia-btn:hover {
      border-color: #667eea;
      background: #f8f9ff;
      transform: translateY(-2px);
    }
    
    .dia-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    #videoContainer {
      display: none;
      position: relative;
      margin-bottom: 24px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    
    #video {
      width: 100%;
      display: block;
      background: #000;
    }
    
    .video-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 3px solid #667eea;
      border-radius: 16px;
      pointer-events: none;
    }
    
    .scan-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, #667eea, transparent);
      animation: scan 2s linear infinite;
    }
    
    @keyframes scan {
      0%, 100% { top: 0; }
      50% { top: calc(100% - 2px); }
    }
    
    #status {
      padding: 16px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 500;
      text-align: center;
      transition: all 0.3s ease;
      min-height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .status-info {
      background: #e8eaf6;
      color: #5e35b1;
    }
    
    .status-success {
      background: #e8f5e9;
      color: #2e7d32;
      animation: pulse 0.5s ease;
    }
    
    .status-error {
      background: #ffebee;
      color: #c62828;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    
    .loading {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 3px solid rgba(102, 126, 234, 0.3);
      border-top: 3px solid #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-left: 10px;
      vertical-align: middle;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .icon {
      font-size: 20px;
    }
    
    @media (max-width: 480px) {
      .container {
        border-radius: 16px;
      }
      
      .header h1 {
        font-size: 20px;
      }
      
      .content {
        padding: 20px;
      }
      
      .dia-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        <span class="icon">📱</span>
        <span>Registro de Asistencia</span>
      </h1>
      <p>Escanea el código QR para registrar tu presencia</p>
    </div>
    
    <div class="content">
      <div class="control-buttons">
        <button id="startButton" class="btn btn-primary">
          <span>▶️</span>
          <span>Activar Cámara</span>
        </button>
        <button id="stopButton" class="btn btn-danger">
          <span>⏹️</span>
          <span>Detener</span>
        </button>
      </div>
      
      <div id="diaSelector">
        <label class="dia-label">Selecciona el día de la capacitación:</label>
        <div class="dia-grid">
          <button class="dia-btn" data-dia="1">Día 1</button>
          <button class="dia-btn" data-dia="2">Día 2</button>
          <button class="dia-btn" data-dia="3">Día 3</button>
          <button class="dia-btn" data-dia="4">Día 4</button>
          <button class="dia-btn" data-dia="5">Día 5</button>
          <button class="dia-btn" data-dia="6">Día 6</button>
        </div>
      </div>

      <div id="videoContainer">
        <video id="video" playsinline></video>
        <div class="video-overlay">
          <div class="scan-line"></div>
        </div>
      </div>
      
      <div id="status" class="status-info">
        Presiona el botón para iniciar
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js  "></script>
  
  <script>
    const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwKehgE_sBn695HHJy1TLulMbyFGYI-K-rlAqu0JFq7_DFrx5NSrQv112BmwFW7qvGq/exec  ";

    const video = document.getElementById('video');
    const videoContainer = document.getElementById('videoContainer');
    const status = document.getElementById('status');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const diaSelector = document.getElementById('diaSelector');
    
    let stream = null;
    let scanning = false;
    let selectedDia = null;
    let lastScannedCode = '';
    let lastScanTime = 0;
    const SCAN_COOLDOWN = 3000;

    function isValidQR(text) {
      if (!text || typeof text !== 'string') return false;
      const parts = text.split('_');
      if (parts.length !== 2) return false;

      const [prefix, dni] = parts;

      // Prefijo: alfanumérico, no vacío
      if (!prefix || !/^[a-zA-Z0-9]+$/.test(prefix)) return false;

      // DNI: debe tener entre 6 y 10 dígitos, solo números
      if (!dni || !/^\d{6,10}$/.test(dni)) return false;

      return true;
    }

    async function sendToSheet(qrCode) {
      const now = Date.now();
      if (qrCode === lastScannedCode && (now - lastScanTime) < SCAN_COOLDOWN) return;
      
      if (!selectedDia) {
        status.className = 'status-error';
        status.innerHTML = '⚠️ Selecciona un día primero';
        return;
      }

      lastScannedCode = qrCode;
      lastScanTime = now;
      status.className = 'status-info';
      status.innerHTML = '⏳ Registrando... <span class="loading"></span>';

      try {
        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ qr: qrCode, dia: selectedDia })
        });
        const data = await response.json();

        if (data.success) {
          status.className = 'status-success';
          status.innerHTML = `✅ ¡Registrado exitosamente!<br><small style="font-size: 13px; opacity: 0.8;">${qrCode} - Día ${selectedDia}</small>`;
          if (navigator.vibrate) navigator.vibrate(200);
        } else {
          status.className = 'status-error';
          status.innerHTML = `❌ Error: ${data.error || 'No registrado'}`;
        }
      } catch (err) {
        status.className = 'status-error';
        status.innerHTML = '⚠️ Error de conexión';
        console.error(err);
      }
    }

    function scanQRCode() {
      if (!scanning) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

        if (code && code.data && isValidQR(code.data)) {
          sendToSheet(code.data);
        }
      }
      requestAnimationFrame(scanQRCode);
    }

    async function startScanner() {
      try {
        status.className = 'status-info';
        status.innerHTML = '🔄 Iniciando cámara...';
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        video.play();
        scanning = true;
        videoContainer.style.display = 'block';
        diaSelector.style.display = 'block';
        startButton.style.display = 'none';
        stopButton.style.display = 'flex';
        status.className = 'status-info';
        status.innerHTML = '📷 Apunta al QR y selecciona el día';
        requestAnimationFrame(scanQRCode);
      } catch (err) {
        status.className = 'status-error';
        status.innerHTML = '❌ Error al acceder a la cámara';
        console.error(err);
        stopScanner();
      }
    }

    function stopScanner() {
      scanning = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      video.srcObject = null;
      videoContainer.style.display = 'none';
      diaSelector.style.display = 'none';
      startButton.style.display = 'flex';
      stopButton.style.display = 'none';
      selectedDia = null;
      document.querySelectorAll('.dia-btn').forEach(b => b.classList.remove('active'));
      status.className = 'status-info';
      status.innerHTML = 'Cámara detenida';
    }

    startButton.addEventListener('click', startScanner);
    stopButton.addEventListener('click', stopScanner);

    document.querySelectorAll('.dia-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dia-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDia = btn.dataset.dia;
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && scanning) stopScanner();
    });
  </script>
</body>
</html>
