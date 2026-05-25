<script>
// Fungsi untuk menutup menu navbar otomatis di HP setelah diklik
function closeMenu() {
  const navbarCollapse = document.getElementById('navbarNav');
  if (window.getComputedStyle(navbarCollapse).display !== 'none') {
    const bsCollapse = new bootstrap.Collapse(navbarCollapse);
    bsCollapse.hide();
  }
}

let DB = { warga: [], pemasukan: [], pengeluaran: [], setting: [], kegiatan: [] };
let userRole = 'warga';

window.onload = () => loadDashboard();

function loadDashboard() {
  document.getElementById('dash-loader').classList.remove('d-none');
  document.getElementById('dash-content').classList.add('d-none');
  
  google.script.run.withSuccessHandler(data => {
    DB = data;aturHakAkses();

    google.script.run.withSuccessHandler(function(dataKegiatan) {
      DB.kegiatan = dataKegiatan;
      tampilkanListKegiatan(); // Memanggil fungsi gambar kartu kegiatan
    }).getMasterKegiatan();


    // --- 1. SINKRONISASI DROPDOWN & TABEL KATEGORI ---
    if (data.settingKeluar) {
      const optKeluar = data.settingKeluar.map(k => `<option value="${k.Kategori_Keluar}">${k.Kategori_Keluar}</option>`).join('');
      const elKategori = document.getElementById('outKategori');
      if (elKategori) elKategori.innerHTML = '<option value="">Pilih Kategori...</option>' + optKeluar;
      
      const tblSettingKeluar = document.getElementById('tbl-setting-keluar-body');
      if (tblSettingKeluar) tblSettingKeluar.innerHTML = data.settingKeluar.map(k => `<tr><td>${k.Kategori_Keluar}</td></tr>`).join('');
    }

    const elSelWarga = document.getElementById('selWarga');
    if (elSelWarga) elSelWarga.innerHTML = '<option value="">Pilih...</option>' + data.warga.map(w => `<option value="${w.Nama}">${w.Nama}</option>`).join('');
    
    // KODE BARU (Sudah menghapus IPL & KAS Gabungan):
    const uniqueJenis = [...new Set(data.pendaftaran.map(p => p.Jenis_Iuran).filter(Boolean))];
    let jHtml = '<option value="">Pilih Iuran...</option>' + uniqueJenis.map(j => `<option value="${j}">${j}</option>`).join('');

    const elSelJenis = document.getElementById('selJenis');
    if (elSelJenis) elSelJenis.innerHTML = jHtml;
    const elFJenis = document.getElementById('fJenis');
    if (elFJenis) elFJenis.innerHTML = jHtml;


    // --- 2. LOGIKA HITUNG DATA UNTUK DASHBOARD ---
    
    // A. Hitung Statistik Warga Aktif
    let totalWarga = data.warga.length;
    let wargaMenetap = data.warga.filter(w => w.Status && w.Status.trim().toLowerCase() === 'menetap').length;
    let wargaBelum = totalWarga - wargaMenetap;

    // B. Ambil Info Bulan Berjalan Saat Ini (Format: YYYY-MM, contoh: 2026-05)
    const hariIni = new Date();
    const tkn = hariIni.getFullYear();
    const bln = String(hariIni.getMonth() + 1).padStart(2, '0');
    const bulanSekarangStr = `${tkn}-${bln}`; 
    
    // Label nama bulan Indonesia untuk Header Kartu
    const namaBulanIndo = hariIni.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

    // C. Filter Transaksi Khusus Bulan Ini Saja
    const pemasukanBulanIni = data.pemasukan.filter(p => p.Bulan === bulanSekarangStr);
    const pengeluaranBulanIni = data.pengeluaran.filter(p => p.Bulan === bulanSekarangStr);

    // D. Hitung Total Kas Keseluruhan (Kumulatif Seluruh Waktu)
    const totalMasukSemua = data.pemasukan.reduce((s, i) => s + Number(i.Jumlah || 0), 0);
    const totalKeluarSemua = data.pengeluaran.reduce((s, i) => s + Number(i.Nilai || 0), 0);
    const saldoKasSistem = totalMasukSemua - totalKeluarSemua;

    // E. Pecah Pemasukan Bulan Ini Berdasarkan Pos/Jenis
    let iplBulanIni = 0;
    let kasBulanIni = 0;
    let lainBulanIni = 0;

    pemasukanBulanIni.forEach(p => {
      const jenisClean = p.Jenis ? p.Jenis.trim().toUpperCase() : "";
      if (jenisClean === "IPL") {
        iplBulanIni += Number(p.Jumlah || 0);
      } else if (jenisClean === "KAS") {
        kasBulanIni += Number(p.Jumlah || 0);
      } else {
        lainBulanIni += Number(p.Jumlah || 0);
      }
    });
    const totalMasukBulanIni = iplBulanIni + kasBulanIni + lainBulanIni;

    // F. Pecah Pengeluaran Bulan Ini Berdasarkan Pos Kategori
    const posKeluarObj = {};
    let totalKeluarBulanIni = 0;
    
    pengeluaranBulanIni.forEach(p => {
      const kat = p.Jenis || "Umum";
      const nilaiTrx = Number(p.Nilai || 0);
      posKeluarObj[kat] = (posKeluarObj[kat] || 0) + nilaiTrx;
      totalKeluarBulanIni += nilaiTrx;
    });

    // Buat element HTML list pengeluaran
    let htmlPosKeluar = "";
    if (Object.keys(posKeluarObj).length > 0) {
      htmlPosKeluar = Object.keys(posKeluarObj).map(k => 
        `<div class="d-flex justify-content-between border-bottom py-1"><span>• ${k}</span><span class="fw-bold text-danger">Rp ${posKeluarObj[k].toLocaleString()}</span></div>`
      ).join('');
    } else {
      htmlPosKeluar = `<div class="text-muted text-center py-2 small">Tidak ada pengeluaran bulan ini</div>`;
    }

// Mencegah error 'Cannot set properties of null' menghentikan jalannya web
window.onerror = function() { return true; };

// --- 3. RENDER LAYOUT DASHBOARD BANNER (ISI POP-UP DIKEMBALIKAN LENGKAP) ---
document.getElementById('dash-content').innerHTML = `
  <div class="col-12 mb-4 p-0">
  <div class="p-4 bg-white shadow-sm border-0" style="border-radius: 15px;">
    
    <div class="d-flex flex-column gap-2">
      
      <div class="d-flex align-items-center gap-2">
        <span class="d-inline-block bg-success rounded-circle" style="width: 10px; height: 10px; animation: pulse 2s infinite;"></span>
        <small class="text-muted fw-bold tracking-wider text-uppercase" style="font-size: 0.75rem; letter-spacing: 1px;">Sistem Informasi Lingkungan</small>
      </div>
      
      <div class="d-flex align-items-center justify-content-between gap-3 my-1">
        <h2 class="fw-bolder text-dark m-0" style="font-family: 'Google Sans', 'Inter', sans-serif; letter-spacing: -0.5px; line-height: 1.2;">
          Selamat Datang di <br class="d-block d-md-none"><span class="text-warning">Lorong 9</span> !
        </h2>
        
        <div class="p-2 bg-light rounded-circle border d-flex align-items-center justify-content-center flex-shrink-0" style="width: 65px; height: 65px;margin-top:-20px;">
          <i class="bi bi-emoji-smile text-warning h2 mb-0 icon-friendly"></i>
        </div>
      </div>
      
      <p class="text-muted mb-0 small lh-base pt-1">
        Mari membangun lingkungan yang rukun, aman, dan transparan.
      </p>

    </div>

  </div>
</div>

<style>
  .icon-friendly {
    display: inline-block;
    animation: gerak-ceria 2.5s infinite;
    transform-origin: center;
  }

  @keyframes gerak-ceria {
    0% { transform: rotate(0deg) scale(1); }
    25% { transform: rotate(-12deg) scale(1.05); }
    50% { transform: rotate(12deg) scale(1.05); }
    75% { transform: rotate(-12deg) scale(1.05); }
    100% { transform: rotate(0deg) scale(1); }
  }
</style>

  <style>
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(40, 167, 69, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
    }
    .carousel-overlay {
      position: relative;
    }
    .carousel-overlay::after {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 100%);
      z-index: 1;
    }
    .carousel-caption {
      z-index: 2;
    }
  </style>

  <div class="col-12 mb-4 p-0">
    <div id="carouselSplit" class="carousel slide border-0" data-bs-ride="carousel" data-bs-touch="true" data-bs-interval="4000" style="border-radius: 15px; overflow: hidden; position: relative; width: 100%;">
      <div class="carousel-inner" style="border-radius: 15px; overflow: hidden;">
        
        <!-- Slide 1 (SUDAH DISESUAIKAN DENGAN POP-UP VISI & MISI SMART & GREEN) -->
        <div class="carousel-item active carousel-overlay" style="border-radius: 15px; overflow: hidden;">
          <!-- PERBAIKAN: Menggunakan gambar bertema perencanaan/visi yang futuristik dan bersih -->
          <img src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800" class="w-100 d-block" style="height: 350px; object-fit: cover; border-radius: 15px;" alt="Gbr 1">
          <div class="carousel-caption d-block text-start start-0 bottom-0 p-4 p-md-5 w-100">
            <!-- PERBAIKAN: Badge disesuaikan menjadi Tujuan Utama -->
            <span class="badge bg-primary mb-2">Tujuan Utama</span>
            <h3 class="fw-bold text-white h4 mb-2">Visi & Misi Lorong 9</h3>
            <!-- PERBAIKAN: Deskripsi disesuaikan dengan konsep Smart & Green -->
            <p class="text-white-50 small mb-3">Komitmen bersama dalam mewujudkan tata kelola lingkungan yang mandiri, transparan, asri, dan unggul berbasis digital.</p>
            <!-- PERBAIKAN: Tombol disesuaikan teksnya menuju pop-up visi misi -->
            <button class="btn btn-light btn-sm rounded-pill px-4 fw-semibold text-primary" data-bs-toggle="modal" data-bs-target="#modalDetailKegiatan">Lihat Visi Misi</button>
          </div>
        </div>

        <!-- Slide 2 (SUDAH DISESUAIKAN DENGAN GAMBAR AKTIVITAS MENANAM/HIJAU) -->
        <div class="carousel-item carousel-overlay" style="border-radius: 15px; overflow: hidden;">
          <!-- PERBAIKAN: Menggunakan gambar aktivitas menanam tanaman/pembibitan yang asri -->
          <img src="https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800" class="w-100 d-block" style="height: 350px; object-fit: cover; border-radius: 15px;" alt="Program Lingkungan">
          <div class="carousel-caption d-block text-start start-0 bottom-0 p-4 p-md-5 w-100">
            <span class="badge bg-warning text-dark mb-2">Inovasi Lingkungan</span>
            <h3 class="fw-bold text-white h4 mb-2">Program Berjalan Lorong 9</h3>
            <p class="text-white-50 small mb-3">Melihat daftar inisiatif swadaya aktif mulai dari pengelolaan sampah, pembibitan tanaman, hingga ketahanan sosial warga.</p>
            <button class="btn btn-warning btn-sm rounded-pill px-4 fw-semibold text-dark" data-bs-toggle="modal" data-bs-target="#modalHasilRapat">Lihat Program</button>
          </div>
        </div>

      </div>
      
      <div class="position-absolute top-50 start-0 translate-middle-y ms-3" style="z-index: 10;">
        <button class="btn btn-dark btn-sm rounded-circle p-0 opacity-75" type="button" data-bs-target="#carouselSplit" data-bs-slide="prev" style="width: 36px; height: 36px;">
          <i class="bi bi-chevron-left text-white"></i>
        </button>
      </div>
      <div class="position-absolute top-50 end-0 translate-middle-y me-3" style="z-index: 10;">
        <button class="btn btn-dark btn-sm rounded-circle p-0 opacity-75" type="button" data-bs-target="#carouselSplit" data-bs-slide="next" style="width: 36px; height: 36px;">
          <i class="bi bi-chevron-right text-white"></i>
        </button>
      </div>
    </div>
  </div>

<!-- ================= POP-UP MODAL: VISI & MISI LORONG 9 (VERSI SMART & GREEN) ================= -->
<div class="modal fade" id="modalDetailKegiatan" tabindex="-1" aria-hidden="true" style="z-index: 1060;">
  <div class="modal-dialog modal-dialog-centered modal-md">
    <div class="modal-content border-0 shadow" style="border-radius: 15px; overflow: hidden;">
      <!-- Header Modal -->
      <div class="modal-header border-0 bg-success text-white p-3">
        <h5 class="modal-title fw-bold h6"><i class="bi bi-flag-fill me-2"></i>Visi & Misi Lorong 9</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      
      <!-- Isi Modal -->
      <div class="modal-body p-4 text-start">
        <!-- Bagian Judul -->
        <h4 class="fw-bold text-dark mb-1">Lorong 9 Bersemi</h4>
        <p class="text-muted small mb-4">Integrasi tata kelola digital dan kemandirian lingkungan.</p>
        
        <!-- Kotak Visi (Sudah Diupdate) -->
        <div class="p-3 bg-light rounded mb-4" style="border-left: 4px solid #0d6efd;">
          <small class="text-primary fw-bold d-block mb-1 text-uppercase tracking-wider" style="font-size: 0.75rem; letter-spacing: 0.5px;">Visi Lorong 9</small>
          <p class="fw-bold text-dark mb-0 lh-base" style="font-size: 0.95rem;">
            "Mewujudkan Lingkungan Lorong 9 yang Mandiri, Transparan, Asri, dan Unggul Berbasis Teknologi Informasi."
          </p>
        </div>

        <!-- Bagian Misi -->
        <small class="text-muted fw-bold d-block mb-2 text-uppercase tracking-wider" style="font-size: 0.75rem; letter-spacing: 0.5px;">Misi Lorong 9</small>
        
        <!-- Misi 1: Pelayanan Digital -->
        <div class="d-flex align-items-start gap-3 mb-3">
          <div class="bg-light rounded p-2 text-primary d-flex align-items-center justify-content-center" style="width: 35px; height: 35px; flex-shrink: 0;">
            <i class="bi bi-cpu"></i>
          </div>
          <div>
            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">Pelayanan Digital</h6>
            <p class="text-muted small mb-0 lh-base">Menyelenggarakan tata kelola administrasi Lorong yang cepat dan transparan melalui sistem digital.</p>
          </div>
        </div>

        <!-- Misi 2: Komunikasi Efektif -->
        <div class="d-flex align-items-start gap-3 mb-3">
          <div class="bg-light rounded p-2 text-primary d-flex align-items-center justify-content-center" style="width: 35px; height: 35px; flex-shrink: 0;">
            <i class="bi bi-chat-left-heart"></i>
          </div>
          <div>
            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">Komunikasi Efektif</h6>
            <p class="text-muted small mb-0 lh-base">Membangun komunikasi antar warga yang efektif dan responsif melalui satu genggaman.</p>
          </div>
        </div>

        <!-- Misi 3: Keterbukaan Finansial -->
        <div class="d-flex align-items-start gap-3 mb-3">
          <div class="bg-light rounded p-2 text-primary d-flex align-items-center justify-content-center" style="width: 35px; height: 35px; flex-shrink: 0;">
            <i class="bi bi-cash-coin"></i>
          </div>
          <div>
            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">Keterbukaan Finansial</h6>
            <p class="text-muted small mb-0 lh-base">Mengelola keuangan iuran warga secara terbuka dan dapat diakses kapan saja.</p>
          </div>
        </div>

        <!-- Misi 4: BARU! KEMANDIRIAN LINGKUNGAN (Sampah & Pembibitan) -->
        <div class="d-flex align-items-start gap-3 mb-0">
          <div class="bg-light rounded p-2 text-success d-flex align-items-center justify-content-center" style="width: 35px; height: 35px; flex-shrink: 0;">
            <i class="bi bi-tree-fill"></i>
          </div>
          <div>
            <h6 class="fw-bold text-success mb-1" style="font-size: 0.9rem;">Kemandirian & Lingkungan Hijau</h6>
            <p class="text-muted small mb-0 lh-base">Membangun ketahanan pangan dan kebersihan lingkungan melalui inovasi pengelolaan sampah terpadu serta pembibitan tanaman produktif secara swadaya.</p>
          </div>
        </div>

      </div>
      
      <!-- Footer Modal -->
      <div class="modal-footer border-0 p-3 bg-light">
        <button type="button" class="btn btn-secondary btn-sm rounded-pill px-3" data-bs-dismiss="modal">Tutup</button>
      </div>
    </div>
  </div>
</div>

<!-- Po-UP Slide 2 : Kegiatn Lingkungan-->
<div class="modal fade" id="modalHasilRapat" tabindex="-1" aria-hidden="true" style="z-index: 1060;">
  <div class="modal-dialog modal-dialog-centered modal-md">
    <div class="modal-content border-0 shadow" style="border-radius: 15px; overflow: hidden;">
      <div class="modal-header border-0 bg-warning text-dark p-3">
        <h5 class="modal-title fw-bold h6"><i class="bi bi-collection-play-fill me-2"></i>Aktivitas Lingkungan</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      
      <div class="modal-body p-4 text-start">
        <h4 class="fw-bold text-dark mb-1">Program Berjalan</h4>
        <p class="text-muted small mb-4">Daftar inisiatif swadaya dan kegiatan aktif warga Lorong 9 saat ini.</p>
        
        <div class="d-flex align-items-start gap-3 mb-3">
          <div class="bg-light rounded p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px; flex-shrink: 0; font-size: 1.2rem;">
            🌱
          </div>
          <div>
            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">Pembibitan Tanaman & Bunga</h6>
            <p class="text-muted small mb-0 lh-base">Pusat pembudidayaan sayuran produktif dan tanaman hias secara swadaya untuk menghijaukan pekarangan warga.</p>
          </div>
        </div>

        <div class="d-flex align-items-start gap-3 mb-3">
          <div class="bg-light rounded p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px; flex-shrink: 0; font-size: 1.2rem;">
            ♻️
          </div>
          <div>
            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">Bank Sampah Lingkungan</h6>
            <p class="text-muted small mb-0 lh-base">Sistem pemilahan dan penyetoran sampah kering layak jual guna mengurangi limbah sekaligus menambah kas warga.</p>
          </div>
        </div>

        <div class="d-flex align-items-start gap-3 mb-3">
          <div class="bg-light rounded p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px; flex-shrink: 0; font-size: 1.2rem;">
            💰
          </div>
          <div>
            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">Penjualan Bibit Unggul</h6>
            <p class="text-muted small mb-0 lh-base">Distribusi hasil pembibitan lokal ke masyarakat luas sebagai salah satu pilar kemandirian ekonomi sirkular RT.</p>
          </div>
        </div>

        <div class="d-flex align-items-start gap-3 mb-3">
          <div class="bg-light rounded p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px; flex-shrink: 0; font-size: 1.2rem;">
            🛢️
          </div>
          <div>
            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">Pengumpulan Minyak Jelantah</h6>
            <p class="text-muted small mb-0 lh-base">Wadah penampungan limbah minyak goreng rumah tangga agar tidak mencemari drainase, untuk disalurkan ke pengolah biodiesel.</p>
          </div>
        </div>

        <div class="d-flex align-items-start gap-3 mb-0">
          <div class="bg-light rounded p-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px; flex-shrink: 0; font-size: 1.2rem;">
            🛡️
          </div>
          <div>
            <h6 class="fw-bold text-dark mb-1" style="font-size: 0.9rem;">Ronda & Kerja Bakti Rutin</h6>
            <p class="text-muted small mb-0 lh-base">Sinergi menjaga keamanan lingkungan malam hari serta aksi gotong royong berkala demi kenyamanan fasilitas umum.</p>
          </div>
        </div>

      </div>
      
      <div class="modal-footer border-0 p-3 bg-light">
        <button type="button" class="btn btn-secondary btn-sm rounded-pill px-3" data-bs-dismiss="modal">Tutup</button>
      </div>
    </div>
  </div>
</div>
`;

// Inisialisasi Carousel
setTimeout(function() {
  var elemenCarousel = document.getElementById('carouselSplit');
  if (elemenCarousel && typeof bootstrap !== 'undefined') {
    new bootstrap.Carousel(elemenCarousel, {
      interval: 4000,
      touch: true,
      ride: 'carousel'
    });
  }
}, 300);

document.getElementById('dash-loader').classList.add('d-none');
document.getElementById('dash-content').classList.remove('d-none');
    
    // =========================================================
    // TAMBAHKAN BARIS INI DI SINI:
    // Agar saat warga/admin masuk, data project juga ikut dimuat
    // =========================================================
    if (typeof muatDataProjectTamu === "function") {
      muatDataProjectTamu();
    }
    // =========================================================

   // --- 4. ENGINE AUTO-FILL OTOMATIS (LAP. WARGA & LAP. KEUANGAN) ---
    const cekElemenLaporan = setInterval(() => {
      const inputBulan = document.getElementById('fBulan');
      const selectJenis = document.getElementById('fJenis'); 
      const inputKeuBulan = document.getElementById('fKeuBulan'); 
      
      // Pastikan elemen penting sudah dirender di layar oleh browser
      if (inputBulan && selectJenis && inputKeuBulan) {
        
        // A. OTONOM TAB LAPORAN WARGA (Otomatis Pilih IPL & Bulan Ini)
        inputBulan.value = bulanSekarangStr;
        
        // KUNCI PERBAIKAN: Langsung set default ke "IPL"
        selectJenis.value = "IPL"; 
        
        // Jalankan perintah klik tombol "CARI" secara otomatis
        const semuaTombol = document.getElementsByTagName('button');
        for (let i = 0; i < semuaTombol.length; i++) {
          if (semuaTombol[i].textContent.trim() === "CARI") {
            semuaTombol[i].click();
            break;
          }
        }

        // B. OTONOM TAB LAPORAN KEUANGAN (Otomatis Proses Bulan Ini)
        inputKeuBulan.value = bulanSekarangStr;
        if (typeof prosesLapKeu === "function") {
          prosesLapKeu(); // Langsung panggil fungsi kalkulasi keuangan internal
        }
        
        // Hentikan pemantauan karena kedua tab sudah terisi & terproses
        clearInterval(cekElemenLaporan);
      }
    }, 500);
  }).getAppData();
}

function autoFillTarif() {
  const w = DB.warga.find(x => x.Nama === document.getElementById('selWarga').value);
  const j = document.getElementById('selJenis').value;
  if(w && j) {
    const tarif = DB.setting.find(s => s.Jenis_Iuran === j && s.Status_Warga === w.Status);
    document.getElementById('inJumlah').value = tarif ? tarif.Nilai : 0;
  }
}

function loadSettings() {
  document.getElementById('tbl-setting-body').innerHTML = DB.setting.length > 0 ? DB.setting.map(s => `<tr><td>${s.Jenis_Iuran}</td><td>${s.Status_Warga}</td><td>Rp ${Number(s.Nilai).toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="3" class="text-center">Belum ada tarif</td></tr>';
}
function toggleFormSetting() { document.getElementById('formSettingArea').classList.toggle('d-none'); }

document.getElementById('formSetting').onsubmit = function(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSaveSet');
  btn.disabled = true; btn.innerHTML = "Menyimpan...";
  google.script.run.withSuccessHandler(msg => {
    alert(msg); e.target.reset(); toggleFormSetting();
    google.script.run.withSuccessHandler(d => { DB = d; loadSettings(); loadDashboard(); btn.disabled = false; btn.innerHTML = "SIMPAN SETTING"; }).getAppData();
  }).saveSettingRow(Object.fromEntries(new FormData(e.target)));
};

/* lap. keuangan */
function prosesLapKeu() {
  const bln = document.getElementById('fKeuBulan').value; 
  if(!bln) return alert('Pilih bulan!');
  
  // 1. Ambil data BERDASARKAN TANGGAL TRANSAKSI REAL (Bukan kolom 'Bulan' IPL-nya)
  // startsWith(bln) memastikan "2026-05-15" akan masuk jika bln = "2026-05"
  const pms = DB.pemasukan.filter(p => p.Tanggal && p.Tanggal.startsWith(bln));
  const pgl = DB.pengeluaran.filter(p => p.Tanggal && p.Tanggal.startsWith(bln));
  
  const tM = pms.reduce((s, i) => s + Number(i.Jumlah || 0), 0);
  const tK = pgl.reduce((s, i) => s + Number(i.Nilai || 0), 0);

  // 2. Hitung Saldo Awal (Semua transaksi yang TANGGAL-nya SEBELUM bulan yang dipilih)
  const pmsSblm = DB.pemasukan.filter(p => p.Tanggal && p.Tanggal < bln);
  const pglSblm = DB.pengeluaran.filter(p => p.Tanggal && p.Tanggal < bln);
  const totalMasukSblm = pmsSblm.reduce((s, i) => s + Number(i.Jumlah || 0), 0);
  const totalKeluarSblm = pglSblm.reduce((s, i) => s + Number(i.Nilai || 0), 0);
  
  const saldoAwal = totalMasukSblm - totalKeluarSblm;
  const pergerakanBulanIni = tM - tK;
  const saldoAkhirRiil = saldoAwal + pergerakanBulanIni;

  // Hitung rincian per kategori MASUK
  const posM = {}; 
  pms.forEach(p => posM[p.Jenis] = (posM[p.Jenis] || 0) + Number(p.Jumlah || 0));

  // Hitung rincian per kategori KELUAR
  const posK = {};
  pgl.forEach(p => posK[p.Jenis] = (posK[p.Jenis] || 0) + Number(p.Nilai || 0));

  document.getElementById('dash-lap-summary').classList.remove('d-none');
  
  // Layout 4 Kotak (Saldo Awal, Masuk, Keluar, Saldo Akhir)
  document.getElementById('dash-lap-summary').innerHTML = `
    <div class="row g-2 mb-2">
      <div class="col-6">
        <div class="card p-2 border-start border-success border-4 shadow-sm h-100">
          <small class="fw-bold text-muted" style="font-size: 10px;">Pemasukan</small>
          <h5 class="text-success fw-bold">Rp ${tM.toLocaleString('id-ID')}</h5>
          <div class="small text-muted" style="font-size: 9px;">${Object.keys(posM).map(k=>`<div>${k}: ${posM[k].toLocaleString('id-ID')}</div>`).join('')}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="card p-2 border-start border-danger border-4 shadow-sm h-100">
          <small class="fw-bold text-muted" style="font-size: 10px;">Pengeluaran</small>
          <h5 class="text-danger fw-bold">Rp ${tK.toLocaleString('id-ID')}</h5>
          <div class="small text-muted" style="font-size: 9px;">${Object.keys(posK).map(k=>`<div>${k}: ${posK[k].toLocaleString('id-ID')}</div>`).join('')}</div>
        </div>
      </div>
    </div>

    <div class="row g-2 mb-3">
      <div class="col-6">
        <div class="card p-2 border-start border-secondary border-4 shadow-sm h-100 bg-light">
          <small class="fw-bold text-muted" style="font-size: 10px;">Saldo Bulan Lalu</small>
          <h5 class="text-secondary fw-bold">Rp ${saldoAwal.toLocaleString('id-ID')}</h5>
        </div>
      </div>
      <div class="col-6">
        <div class="card p-2 border-start border-primary border-4 shadow-sm h-100 bg-light">
          <small class="fw-bold text-dark" style="font-size: 10px;">Saldo Akhir</small>
          <h5 class="text-dark fw-bold">Rp ${saldoAkhirRiil.toLocaleString('id-ID')}</h5>
        </div>
      </div>
    </div>`;

  document.getElementById('detail-lap-area').classList.remove('d-none');
  
  // Isi Tabel Rincian Masuk (Saya tambahkan info "Bayar Untuk Bulan" agar tidak bingung)
  document.getElementById('tbl-det-masuk').innerHTML = pms.map(p => `
    <tr>
    <!-- Kolom 1: Tanggal -->
      <td class="align-middle text-center" >${p.Tanggal}</td>
      
      <td class="align-middle">
        <!-- Kolom 2: Jenis Iuran (Badge) + Nama + Bulan -->
        <span class="badge bg-warning text-white">${p.Jenis}</span> 
        ${p.Nama} Bulan  
        <span>
          ${(() => {
            const [y, m] = p.Bulan.split('-');
            return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
          })()}
        </span>
      </td>
      
      <td class="align-middle">
        <!-- Kolom 3: Metode Pembayaran -->
        <span class="badge bg-light text-dark border">${p.Metode}</span>
      </td>
      
      <td class="text-end align-middle">
        <!-- Kolom 4: Nominal -->
        Rp ${Number(p.Jumlah).toLocaleString('id-ID')}
      </td>
    </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted p-3">Tidak ada pemasukan</td></tr>';

  // Isi Tabel Rincian Keluar
  document.getElementById('tbl-det-keluar').innerHTML = pgl.map(p => `
    <tr>
      <td class="align-middle">${p.Tanggal}</td>
      <td class="align-middle"><span class="badge bg-warning text-dark" style="font-size:10px">${p.Jenis || 'Umum'}</span></td>
      <td class="align-middle">${p.Keterangan}</td>
      <td class="align-middle"><span class="badge bg-light text-dark border">${p.Metode}</span></td>
      <td class="text-end text-danger fw-bold align-middle">Rp ${Number(p.Nilai).toLocaleString('id-ID')}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted p-3">Tidak ada pengeluaran</td></tr>';
}
/* end lap. keuangan */

function loadWarga() {
  const tbody = document.getElementById('tbl-warga-body');
  if (DB.warga.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Data Kosong</td></tr>';
    return;
  }
  
  // Ambil element header tabel
  const tableHeader = document.getElementById('tabelWarga').getElementsByTagName('thead')[0];
  if (userRole === 'admin') {
    tableHeader.innerHTML = `<tr><th style="width: 5%; text-align:center;">No.</th><th>Nama</th><th class="text-center">Hubungi</th><th class="text-center">Status</th><th class="text-end">Aksi</th></tr>`;
  } else {
    tableHeader.innerHTML = `<tr><th style="width: 5%; text-align:center;">No.</th><th>Nama</th><th class="text-center">Hubungi</th><th class="text-center">Status</th></tr>`;
  }
  
  tbody.innerHTML = DB.warga.map((w, i) => {
    // 1. Tombol Aksi (Hanya Admin)
    let kolomAksi = "";
    if (userRole === 'admin') {
      kolomAksi = `
        <td class="text-end align-middle">
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editWarga('${w.Nama}')">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="hapusWarga('${w.Nama}')">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>`;
    }

    // 2. Tombol Kirim Pesan (WhatsApp)
    // 2. Tombol Kirim Pesan (WhatsApp) - FIX PERBAIKAN UNTUK APK & WEB
    let waButton = `<span class="text-muted small">-</span>`;
    if (w.No_Telp) {
      let noTelp = w.No_Telp.toString().replace(/\D/g, ''); // Bersihkan karakter selain angka
      if (noTelp.length > 8) {
        if (noTelp.startsWith('0')) noTelp = '62' + noTelp.substring(1);
        
        if (typeof AndroidPrint !== 'undefined') {
          // Kirim pesan kosong karena ini hanya tombol chat langsung tanpa draf tagihan iuran
          waButton = `<button type="button" onclick="AndroidPrint.bukaWhatsApp('${noTelp}', '')" class="btn btn-sm btn-success" style="font-size: 10px; padding: 3px 8px; border-radius: 6px;">
                        <i class="bi bi-whatsapp"></i>
                      </button>`;
        } else {
          waButton = `<a href="https://wa.me/${noTelp}" target="_blank" class="btn btn-sm btn-success" style="font-size: 10px; padding: 3px 8px; border-radius: 6px;">
                        <i class="bi bi-whatsapp"></i>
                      </a>`;
        }
      }
    }

    // 3. Desain Teks Status (Badge)
    let badgeStatus = w.Status.trim().toLowerCase() === 'menetap' ? 'bg-success' : 'bg-danger';

    // 4. Susun Baris Tabel Baru
    return `
      <tr>
        <td class="text-center align-middle">${i + 1}</td> 
        <td class="align-middle">
          <strong class="d-block text-dark" style="font-size: 13px;">${w.Nama}</strong>
          <small class="text-muted" style="font-size: 11px; display: block; line-height: 1.2;">${w.Alamat || '-'}</small>
        </td>
        <td class="text-center align-middle">${waButton}</td>
        <td class="text-center align-middle"><span class="badge ${badgeStatus}" style="font-size: 10px;">${w.Status}</span></td>
        ${kolomAksi}
      </tr>
    `;
  }).join('');
  
  filterDanHitungWarga();
}

function hapusWarga(nama) {
  if (confirm(`Hapus data warga "${nama}"?`)) {
    google.script.run.withSuccessHandler(msg => {
      alert(msg);
      google.script.run.withSuccessHandler(data => { 
        DB = data; 
        loadWarga(); 
        loadDashboard(); 
      }).getAppData();
    }).deleteData('Warga', nama);
  }
}

function editWarga(nama) {
  const warga = DB.warga.find(w => w.Nama === nama);
  
  if (!warga) {
    alert("Data warga tidak ditemukan!");
    return;
  }

  if (document.getElementById('wNama')) document.getElementById('wNama').value = warga.Nama;
  if (document.getElementById('wAlamat')) document.getElementById('wAlamat').value = warga.Alamat || '';
  if (document.getElementById('wTelp')) document.getElementById('wTelp').value = warga.No_Telp || '';
  if (document.getElementById('wStatus')) document.getElementById('wStatus').value = warga.Status;

  const modalElement = document.getElementById('modalWarga');
  if (modalElement) {
    const myModal = new bootstrap.Modal(modalElement);
    myModal.show();
  } else {
    const tabWarga = document.querySelector('button[data-bs-target="#tab-warga"]');
    if (tabWarga) {
      new bootstrap.Tab(tabWarga).show();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  document.getElementById('wNama').readOnly = true;
}

function simpanWarga() {
  const data = {
    Nama: document.getElementById('wNama').value,
    Alamat: document.getElementById('wAlamat').value,
    No_Telp: document.getElementById('wTelp').value,
    Status: document.getElementById('wStatus').value
  };
}

function openModalWarga(d = null) {
  const form = document.getElementById('formWarga');
  form.reset();
  document.getElementById('wNama').readOnly = false;
  document.getElementById('wId').value = d ? d.ID : "";
  new bootstrap.Modal('#modalWarga').show();
}

document.getElementById('formWarga').onsubmit = (e) => { 
  e.preventDefault(); 
  document.getElementById('btnWarga').disabled = true;
  google.script.run.withSuccessHandler(m => { 
    alert(m); bootstrap.Modal.getInstance('#modalWarga').hide(); 
    google.script.run.withSuccessHandler(d => { DB = d; loadWarga(); document.getElementById('btnWarga').disabled = false; }).getAppData(); 
  }).upsertWarga(Object.fromEntries(new FormData(e.target))); 
};

document.getElementById('formMasuk').onsubmit = (e) => { 
  e.preventDefault(); 
  document.getElementById('btnMasuk').disabled = true;
  google.script.run.withSuccessHandler(m => { 
    alert(m); 
    e.target.reset(); 
    loadDashboard(); 
    document.getElementById('btnMasuk').disabled = false; 

    // --- KODE PENUTUP POPUP OTOMATIS ---
    const modalElement = document.getElementById('modalInputKeuangan');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
      modalInstance.hide(); 
    }
    // -----------------------------------
    
  }).saveTrx('Pemasukan', Object.fromEntries(new FormData(e.target))); 
};

document.getElementById('formKeluar').onsubmit = (e) => { 
  e.preventDefault(); 
  document.getElementById('btnKeluar').disabled = true;
  google.script.run.withSuccessHandler(m => { 
    alert(m); 
    e.target.reset(); 
    loadDashboard(); 
    document.getElementById('btnKeluar').disabled = false; 

    // --- KODE PENUTUP POPUP OTOMATIS ---
    const modalElement = document.getElementById('modalInputKeuangan');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
      modalInstance.hide(); 
    }
    // -----------------------------------

  }).saveTrx('Pengeluaran', Object.fromEntries(new FormData(e.target))); 
};

// --- FUNGSI 1: PROSES LAPORAN WARGA (TOMBOL CARI) ---
function prosesLapWarga() {
  const bln = document.getElementById('fBulan').value;
  const jns = document.getElementById('fJenis').value;
  const flt = document.getElementById('fStatusBayar').value; // SEMUA, LUNAS, BELUM

  if (!bln || !jns) {
    alert('Silakan pilih Bulan dan Jenis Iuran terlebih dahulu!');
    return;
  }

  // 1. Ambil daftar warga wajib bayar
  const wargaWajibBayar = DB.pendaftaran.filter(p => 
    p.Jenis_Iuran === jns && 
    p.Status_Keikutsertaan && p.Status_Keikutsertaan.trim().toLowerCase() === 'ikut'
  );

  const elKeikutsertaan = document.getElementById('count-keikutsertaan');
  if (elKeikutsertaan) {
    elKeikutsertaan.innerText = wargaWajibBayar.length;
  }

  // === KUNCI PERBAIKAN: Deteksi Sifat Iuran ===
  let sifatIuran = "bulanan";
  if (wargaWajibBayar.length > 0 && wargaWajibBayar[0].Sifat) {
     sifatIuran = wargaWajibBayar[0].Sifat.trim().toLowerCase();
  }

  // 2. Ambil riwayat pembayaran SESUAI SIFATNYA
  let dataBayarWarga = [];
  if (sifatIuran === "sekali") {
     // Jika iuran sekali tarik: Ambil semua data tanpa peduli bulannya!
     dataBayarWarga = DB.pemasukan.filter(p => p.Jenis === jns);
  } else {
     // Jika iuran bulanan: Ambil ketat sesuai bulan yang dipilih (Filter asli Anda)
     dataBayarWarga = DB.pemasukan.filter(p => p.Jenis === jns && p.Bulan === bln);
  }

  let countLunas = 0;
  let countBelum = 0;
  let moneyLunas = 0;
  let moneyBelum = 0;
  let htmlRows = "";
  let noUrut = 1;

  // 3. Cross-check kecocokan data
  wargaWajibBayar.forEach(w => {
    // Cari data bayar di dalam "dataBayarWarga" yang sudah disesuaikan sifatnya
    const sudahBayar = dataBayarWarga.find(p => p.Nama === w.Nama_Warga);
    
    let statusFix = "";
    let jumlahBayarFix = 0;
    let nominalTagihan = Number(w.Nominal || 0);

    if (sudahBayar) {
      statusFix = "LUNAS";
      jumlahBayarFix = Number(sudahBayar.Jumlah || 0);
      countLunas++;
      moneyLunas += jumlahBayarFix;
    } else {
      statusFix = "BELUM";
      jumlahBayarFix = 0;
      countBelum++;
      moneyBelum += nominalTagihan;
    }

    const masterWarga = DB.warga.find(mw => mw.Nama === w.Nama_Warga);
    const alamatWarga = masterWarga ? masterWarga.Alamat : '-';
    const statusTinggal = masterWarga ? masterWarga.Status : '-';

    // 4. Render tabel (Ditambahkan kolom nomor urut)
    if (flt === "SEMUA" || flt === statusFix) {
      const bgRow = statusFix === "BELUM" ? "table-danger" : "";
      const badgeClass = statusFix === "BELUM" ? "bg-danger" : "bg-success";
      
      htmlRows += `
  <tr class="${bgRow}">
    <td class="text-center align-middle">${noUrut++}</td> 
    <td class="align-middle">
      <strong class="d-block text-dark" style="font-size: 13px;">${w.Nama_Warga}</strong>
      <small class="text-muted" style="display: block; line-height: 1.2; margin-bottom: 3px;">${alamatWarga}</small>
      <span class="badge bg-secondary" style="font-size: 9px;">${statusTinggal}</span>
    </td>
    <td class="text-center align-middle"><span class="badge ${badgeClass}">${statusFix}</span></td>
    <td class="text-center fw-bold align-middle">Rp ${Number(statusFix === "LUNAS" ? jumlahBayarFix : nominalTagihan).toLocaleString()}</td>
  </tr>
`;
    }
  });

  // 5. Render Ringkasan
  document.getElementById('count-lunas').innerText = countLunas;
  document.getElementById('money-lunas').innerText = "Rp " + moneyLunas.toLocaleString();
  document.getElementById('count-belum').innerText = countBelum;
  document.getElementById('money-belum').innerText = "Rp " + moneyBelum.toLocaleString();
  document.getElementById('lap-warga-summary').classList.remove('d-none');

  // 6. Cetak ke tabel
  const tbody = document.getElementById('tbl-lap-warga-body');
  if (htmlRows === "") {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-3">Tidak ada data warga yang cocok dengan filter ini</td></tr>`;
  } else {
    tbody.innerHTML = htmlRows;
  }
}


// --- FUNGSI LENGKAP: LACAK SEMUA TUNGGAKAN ---
function lacakSemuaTunggakan() {
  const elBulan = document.getElementById('fBulan');
  const blnSelected = elBulan ? elBulan.value : "";
  
  if (!blnSelected) {
    alert('Silakan tentukan bulan acuan di kotak filter Bulan terlebih dahulu!');
    return;
  }

  if (!DB.pendaftaran || DB.pendaftaran.length === 0) {
    alert('Tunggu sebentar, data pendaftaran sedang dimuat dari server...');
    return;
  }

  let countLunas = 0, countBelum = 0, countKeikutsertaan = 0; 
  let moneyLunas = 0, moneyBelum = 0, htmlRows = "";
  let noUrut = 1;

  const grupWarga = [...new Set(DB.pendaftaran.map(p => p.Nama_Warga))];

  grupWarga.forEach(nama => {
    const iuranWajibWarga = DB.pendaftaran.filter(p => 
      p.Nama_Warga === nama && 
      p.Status_Keikutsertaan && p.Status_Keikutsertaan.trim().toLowerCase() === 'ikut'
    );

    if (iuranWajibWarga.length === 0) return;

    countKeikutsertaan++; 
    let akumulasiTunggakanTotal = 0;
    let rincianWeb = []; 
    let rincianWA = [];

    iuranWajibWarga.forEach(iuran => {
      const nominalTarif = Number(iuran.Nominal || 0);
      const jenisIuran = iuran.Jenis_Iuran;
      const bulanMulaiTagihan = iuran.Mulai_Bulan ? iuran.Mulai_Bulan.trim() : blnSelected.substring(0,4) + "-01";
      const semuaBulanWajib = hitungRentangBulan(bulanMulaiTagihan, blnSelected);

      semuaBulanWajib.forEach(b => {
        // Deteksi Sifat Iuran
        const masterIuran = DB.pendaftaran.find(p => p.Jenis_Iuran === jenisIuran);
        const sifatIuran = masterIuran && masterIuran.Sifat ? masterIuran.Sifat.trim().toLowerCase() : "bulanan";

        let cekBayar;
        if (sifatIuran === "sekali") {
          cekBayar = DB.pemasukan.find(p => p.Nama === nama && p.Jenis === jenisIuran);
        } else {
          cekBayar = DB.pemasukan.find(p => p.Nama === nama && p.Jenis === jenisIuran && p.Bulan === b);
        }

        if (!cekBayar) {
          akumulasiTunggakanTotal += nominalTarif;
          let namaBulanPendek = new Date(b + "-01").toLocaleDateString('id-ID', {month: 'short', year: '2-digit'});
          rincianWeb.push(`${jenisIuran} (${namaBulanPendek})`);
          rincianWA.push(`${jenisIuran} (${namaBulanPendek}) : Rp ${nominalTarif.toLocaleString('id-ID')}`);
        }
      });
    });

    const masterWarga = DB.warga.find(mw => mw.Nama === nama);
    const alamatWarga = masterWarga ? masterWarga.Alamat : '-';
    const statusTinggal = masterWarga ? masterWarga.Status : '-';
    const noTelpWarga = masterWarga ? masterWarga.No_Telp : ''; 

    if (akumulasiTunggakanTotal > 0) {
      countBelum++;
      moneyBelum += akumulasiTunggakanTotal;
      
      // 1. LOGIKA TOMBOL WA (DIBUAT TERPISAH)
    let tombolWA = "";
    if (noTelpWarga && noTelpWarga.length > 8) {
      let cleanPhone = noTelpWarga.toString().replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
      
      let pesanTeks = `Halo *${nama}*, ini dari pengurus Lorong 9. \nIzin menginformasikan bahwa terdapat tagihan iuran sebesar *Rp ${akumulasiTunggakanTotal.toLocaleString('id-ID')}*.\n\n*Rincian:*\n${rincianWA.join('\n')}\n\nMohon bantuannya untuk penyelesaian administrasi tersebut. Terima kasih. 🙏`;
      let pesanEncoded = encodeURIComponent(pesanTeks);
      
      tombolWA = `<a href="https://wa.me/${cleanPhone}?text=${pesanEncoded}" target="_blank" 
                  class="btn btn-sm btn-success d-block mt-2 w-100" 
                  style="font-size: 12px; padding: 4px 6px;">
                  <i class="bi bi-whatsapp me-1"></i> Tagih</a>`;
    } else {
      tombolWA = `<span class="badge bg-secondary d-block mt-2" style="font-size: 9px;">No. WA tidak ada</span>`;
    }

    // 2. KET IURAN (HANYA BERISI RINCIAN, TANPA TOMBOL)
    const ketIuran = `<div class="mt-1"><small class="text-danger" style="font-size:11px; display:block; max-width:250px;"><strong>Rincian:</strong> ${rincianWeb.join(', ')}</small></div>`;
    
    // 3. SUSUNAN BARIS (TOMBOL WA DITARUH DI KOLOM JUMLAH)
    htmlRows += `
  <tr class="table-danger">
    <td class="text-center">${noUrut++}</td>
    <td><strong>${nama}</strong>${ketIuran}</td>
    <td><small>${alamatWarga}</small></td>
    <td class="text-center"><small>${statusTinggal}</small></td>
    <td class="text-center"><span class="badge bg-danger">BELUM</span></td>
    <td class="text-end">
       <div style="font-weight:700; color:#dc2626; margin-bottom: 8px;">
         Rp ${akumulasiTunggakanTotal.toLocaleString('id-ID')}
       </div>
       <div style="display:flex; justify-content: flex-end;">
         ${tombolWA}
       </div>
    </td>
  </tr>
`;
     } else {
      countLunas++;
     }
   });

  // Update UI Dashboard Summary
  document.getElementById('count-keikutsertaan').innerText = countKeikutsertaan;
  document.getElementById('count-lunas').innerText = countLunas;
  document.getElementById('money-lunas').innerText = "Rp " + moneyLunas.toLocaleString('id-ID');
  document.getElementById('count-belum').innerText = countBelum;
  document.getElementById('money-belum').innerText = "Rp " + moneyBelum.toLocaleString('id-ID');
  document.getElementById('lap-warga-summary').classList.remove('d-none');

  // Update Tabel
  const tbody = document.getElementById('tbl-lap-warga-body');
  if (htmlRows === "") {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-success p-3">🎉 Luar biasa! Seluruh warga lunas.</td></tr>`;
  } else {
    tbody.innerHTML = htmlRows;
  }
}

// Fungsi untuk menghitung jumlah warga berdasarkan status
function hitungKeterangan() {
  // Sesuaikan "tabelWarga" dengan ID tabel yang ada di kode Anda
  let tabel = document.getElementById("tabelWarga"); 
  // Jika tabel tidak ditemukan, hentikan fungsi
  if (!tabel) return; 

  let baris = tabel.getElementsByTagName("tr");
  let menetap = 0;
  let belumMenetap = 0;
  let semua = 0;

  // Mulai dari i = 1 untuk melewati baris header (Judul Kolom)
  for (let i = 1; i < baris.length; i++) {
    let kolomStatus = baris[i].getElementsByTagName("td")[3]; // Indeks 3 adalah kolom ke-4 (Status)
    
    if (kolomStatus) {
      semua++;
      let teksStatus = kolomStatus.textContent || kolomStatus.innerText;
      
      if (teksStatus.trim() === "Menetap") {
        menetap++;
      } else if (teksStatus.trim() === "Belum Menetap") {
        belumMenetap++;
      }
    }
  }

  // Tampilkan hasilnya ke HTML
  document.getElementById("jmlSemua").innerText = semua;
  document.getElementById("jmlMenetap").innerText = menetap;
  document.getElementById("jmlBelumMenetap").innerText = belumMenetap;
}

// Fungsi untuk memfilter tabel berdasarkan dropdown
function filterTabelWarga() {
  let pilihan = document.getElementById("filterStatus").value;
  let tabel = document.getElementById("tabelWarga");
  let baris = tabel.getElementsByTagName("tr");

  for (let i = 1; i < baris.length; i++) {
    let kolomStatus = baris[i].getElementsByTagName("td")[3]; // Kolom Status
    
    if (kolomStatus) {
      let teksStatus = kolomStatus.textContent || kolomStatus.innerText;
      
      // Logika untuk menampilkan atau menyembunyikan baris
      if (pilihan === "Semua" || teksStatus.trim() === pilihan) {
        baris[i].style.display = ""; // Tampilkan baris
      } else {
        baris[i].style.display = "none"; // Sembunyikan baris
      }
    }
  }
}

function filterDanHitungWarga() {
  // 1. Ambil nilai pilihan filter dropdown
  let pilihan = document.getElementById("filterStatus").value.toLowerCase();
  
  // 2. Ambil semua baris data dari body tabel warga Anda
  let baris = document.querySelectorAll("#tbl-warga-body tr");
  
  // Penampung hitungan kartu ringkasan
  let menetap = 0;
  let belumMenetap = 0;
  let semua = 0;
  let nomorBarisBaru = 1; // Untuk menyusun ulang nomor urut 1, 2, 3 setelah difilter

  // 3. Jalankan perulangan
  baris.forEach(row => {
    // PERBAIKAN: Karena ada kolom nomor di paling kiri, Status bergeser ke indeks [4] (kolom ke-5)
    let kolomStatus = row.getElementsByTagName("td")[3]; 
    
    if (kolomStatus) {
      let teksStatus = (kolomStatus.textContent || kolomStatus.innerText).trim();
      let teksStatusLower = teksStatus.toLowerCase();
      
      // Hitung total data asli yang ada di sistem
      if (teksStatusLower === "menetap") menetap++;
      if (teksStatusLower === "belum menetap") belumMenetap++;
      semua++;

      // Logika menyembunyikan atau menampilkan baris sesuai filter
      if (pilihan === "semua" || teksStatusLower === pilihan) {
        row.style.display = ""; 
        // Update nomor urut di kolom pertama ([0]) agar tetap berurutan rapi
        row.getElementsByTagName("td")[0].innerText = nomorBarisBaru++;
      } else {
        row.style.display = "none"; 
      }
    }
  });

  // 4. Masukkan kembali hasil hitungan ke element kartu HTML Anda
  document.getElementById("jmlSemua").innerText = semua;
  document.getElementById("jmlMenetap").innerText = menetap;
  document.getElementById("jmlBelumMenetap").innerText = belumMenetap;
}

// --- FUNGSI BANTUAN UNTUK MENGHITUNG RENTANG BULAN TUNGGAKAN ---
function hitungRentangBulan(start, end) {
  let dateStart = new Date(start + "-01");
  let dateEnd = new Date(end + "-01");
  let months = [];
  
  while (dateStart <= dateEnd) {
    let y = dateStart.getFullYear();
    let m = String(dateStart.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
    dateStart.setMonth(dateStart.getMonth() + 1);
  }
  return months;
}

// --- FUNGSI UTAMA: LACAK TUNGGAKAN (SUDAH BISA MEMBACA IURAN BULANAN & SEKALI) ---
function lacakSemuaTunggakan() {
  const elBulan = document.getElementById('fBulan');
  const blnSelected = elBulan ? elBulan.value : "";
  
  if (!blnSelected) {
    alert('Silakan tentukan bulan acuan di kotak filter Bulan terlebih dahulu!');
    return;
  }

  if (!DB.pendaftaran || DB.pendaftaran.length === 0) {
    alert('Tunggu sebentar, data pendaftaran sedang dimuat dari server...');
    return;
  }

  let countLunas = 0, countBelum = 0, countKeikutsertaan = 0; 
  let moneyLunas = 0, moneyBelum = 0, htmlRows = "";
  let noUrut = 1; 

  const grupWarga = [...new Set(DB.pendaftaran.map(p => p.Nama_Warga))];

  grupWarga.forEach(nama => {
    const iuranWajibWarga = DB.pendaftaran.filter(p => 
      p.Nama_Warga === nama && 
      p.Status_Keikutsertaan && p.Status_Keikutsertaan.trim().toLowerCase() === 'ikut'
    );

    if (iuranWajibWarga.length === 0) return;

    countKeikutsertaan++; 

    let akumulasiTunggakanTotal = 0;
    let rincianWeb = []; 
    let rincianWA = [];

    iuranWajibWarga.forEach(iuran => {
      const nominalTarif = Number(iuran.Nominal || 0);
      
      // === KUNCI PERBAIKAN: Baca kolom 'Sifat' dari spreadsheet ===
      const sifatIuran = iuran.Sifat ? iuran.Sifat.trim().toLowerCase() : "bulanan"; 

      if (sifatIuran === "sekali") {
        // --- JIKA SIFATNYA "SEKALI" (Contoh: Iuran Portal) ---
        // Cukup cek apakah dia PERNAH bayar di bulan apapun
        const cekPernahBayar = DB.pemasukan.find(p => p.Nama === nama && p.Jenis === iuran.Jenis_Iuran);
        
        if (!cekPernahBayar) {
          akumulasiTunggakanTotal += nominalTarif;
          rincianWeb.push(`${iuran.Jenis_Iuran} (Belum Lunas)`);
          rincianWA.push(`${iuran.Jenis_Iuran} : Rp ${nominalTarif.toLocaleString('id-ID')}`);
        }
      } else {
        // --- JIKA SIFATNYA "BULANAN" (Contoh: IPL, KAS) ---
        // Gunakan pengecekan bulan seperti biasa
        const bulanMulaiTagihan = iuran.Mulai_Bulan ? iuran.Mulai_Bulan.trim() : blnSelected.substring(0,4) + "-01";
        const semuaBulanWajib = hitungRentangBulan(bulanMulaiTagihan, blnSelected);

        semuaBulanWajib.forEach(b => {
          const cekBayar = DB.pemasukan.find(p => p.Nama === nama && p.Jenis === iuran.Jenis_Iuran && p.Bulan === b);
          
          if (!cekBayar) {
            akumulasiTunggakanTotal += nominalTarif;
            let namaBulanPendek = new Date(b + "-01").toLocaleDateString('id-ID', {month: 'short', year: '2-digit'});
            rincianWeb.push(`${iuran.Jenis_Iuran} (${namaBulanPendek})`);
            rincianWA.push(`${iuran.Jenis_Iuran} (${namaBulanPendek}) : Rp ${nominalTarif.toLocaleString('id-ID')}`);
          }
        });
      }
    });

    const masterWarga = DB.warga.find(mw => mw.Nama === nama);
    const alamatWarga = masterWarga ? masterWarga.Alamat : '-';
    const statusTinggal = masterWarga ? masterWarga.Status : '-';
    const noTelpWarga = masterWarga ? masterWarga.No_Telp : ''; 

    if (akumulasiTunggakanTotal > 0) {
      countBelum++;
      moneyBelum += akumulasiTunggakanTotal;
      
    let tombolWA = "";
    if (noTelpWarga && noTelpWarga.length > 8) {
        let cleanPhone = noTelpWarga.toString().replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
        let pesanTeks = `Halo *${nama}*, ini dari pengurus Lorong 9. \nIzin menginformasikan bahwa terdapat tagihan iuran yang belum terselesaikan sebesar *Rp ${akumulasiTunggakanTotal.toLocaleString('id-ID')}*. \n*Rincian:*\n${rincianWA.join('\n')}\nMohon bantuannya untuk penyelesaian administrasi tersebut ya.\n\nPembayaran bisa CASH atau Transfer ke rekening BCA 7651359400 an Slamet Santoso. Terima kasih.`;
        let pesanEncoded = encodeURIComponent(pesanTeks);
        
        // Gunakan d-block agar tombol otomatis turun ke bawah nominal
        // PERBAIKAN: Jika dibuka dari APK, bypass iframe menggunakan Native Java/Kotlin interface
        if (typeof AndroidPrint !== 'undefined') {
          tombolWA = `<button type="button" onclick="AndroidPrint.bukaWhatsApp('${cleanPhone}', '${pesanEncoded}')" class="btn btn-sm btn-success d-block mt-2 w-100" style="font-size: 12px; padding: 4px 6px;">
                        <i class="bi bi-whatsapp me-1"></i> Tagih
                      </button>`;
        } else {
          // Jika dibuka dari browser laptop biasa
          tombolWA = `<a href="https://wa.me/${cleanPhone}?text=${pesanEncoded}" target="_blank" class="btn btn-sm btn-success d-block mt-2 w-100" style="font-size: 12px; padding: 4px 6px;">
                        <i class="bi bi-whatsapp me-1"></i> Tagih
                      </a>`;
        }

    } else {
        tombolWA = `<span class="badge bg-secondary d-block mt-2" style="font-size: 9px;">No. WA tidak ada</span>`;
    }

      const ketIuran = `
        <div class="mt-1">
          <small class="text-danger" style="font-size:11px; display:block; max-width:350px; word-break:break-word">
            <strong>Rincian:</strong> ${rincianWeb.join(', ')}
          </small>
        </div>
    `;
      
      htmlRows += `
      <tr class="table-danger">
        <td class="text-center align-middle">${noUrut++}</td>
        <td class="align-middle">
          <strong class="d-block text-dark" style="font-size: 13px;">${nama}</strong>
          <small class="text-muted" style="display: block; line-height: 1.2; margin-bottom: 3px;">${alamatWarga}</small>
          <span class="badge bg-secondary" style="font-size: 9px;">${statusTinggal}</span>
          ${ketIuran}
        </td>
        <td class="text-center align-middle"><span class="badge bg-danger">BELUM</span></td>
        <td class="text-end fw-bold text-danger align-middle text-center">
          <div style="white-space: nowrap;">Rp ${akumulasiTunggakanTotal.toLocaleString('id-ID')}</div>
          ${tombolWA}
        </td>
      </tr>
    `;

    } else {
      countLunas++;
      const bayarBulanIni = DB.pemasukan.filter(p => p.Nama === nama && p.Bulan === blnSelected);
      bayarBulanIni.forEach(p => moneyLunas += Number(p.Jumlah || 0));
    }
  });

  document.getElementById('count-keikutsertaan').innerText = countKeikutsertaan;
  document.getElementById('count-lunas').innerText = countLunas;
  document.getElementById('money-lunas').innerText = "Rp " + moneyLunas.toLocaleString('id-ID');
  document.getElementById('count-belum').innerText = countBelum;
  document.getElementById('money-belum').innerText = "Rp " + moneyBelum.toLocaleString('id-ID');
  document.getElementById('lap-warga-summary').classList.remove('d-none');

  const tbody = document.getElementById('tbl-lap-warga-body');
  if (htmlRows === "") {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-success p-3">🎉 Luar biasa! Seluruh warga sudah lunas, tidak ada tunggakan sampai bulan ini.</td></tr>`;
  } else {
    tbody.innerHTML = htmlRows;
  }
}


// --- FUNGSI MENGATUR TAMPILAN SESUAI HAK AKSES ---
function aturHakAkses() {
  const menuInput = document.getElementById('menu-input');
  const menuIpl = document.getElementById('menu-ipl'); 
  const areaAuth = document.getElementById('area-auth');
  const btnLacak = document.querySelector('button[onclick="lacakSemuaTunggakan()"]');
  const btnInputIuranBaru = document.getElementById('btn-input-iuran-baru') || document.querySelector('button[onclick="bukaModalTambahIuran()"]');
  const btnTambahKegiatan = document.getElementById('btn-tambah-kegiatan'); 
  const btnBukaInputKeuangan = document.getElementById('btnBukaInput');
  const btnShareWA = document.getElementById('btn-share-wa'); // Tambahkan baris ini
  
  
  // --- TAMBAHAN: Definisikan tombol cetak Anda ---
  const btnCetakLaporan = document.getElementById('btn-cetak-laporan'); 

  if (userRole === 'admin') {
    // --- MODE ADMIN ---
    if (menuInput) menuInput.classList.remove('d-none');
    if (menuIpl) menuIpl.classList.remove('d-none');
    if (btnLacak) btnLacak.classList.remove('d-none');
    if (typeof btnWargaBaru !== 'undefined' && btnWargaBaru) btnWargaBaru.classList.remove('d-none');
        if (btnShareWA) btnShareWA.classList.remove('d-none');
    if (btnInputIuranBaru) btnInputIuranBaru.classList.remove('d-none');
    if (btnTambahKegiatan) btnTambahKegiatan.classList.remove('d-none'); 
    if (btnBukaInputKeuangan) btnBukaInputKeuangan.classList.remove('d-none');

    // --- Tampilkan tombol cetak untuk Admin ---
    if (btnCetakLaporan) btnCetakLaporan.classList.remove('d-none');

    if (areaAuth) {
      areaAuth.innerHTML = `<button type="button" class="btn btn-danger" onclick="logoutAdmin()">
        <i class="bi bi-box-arrow-left me-1"></i> Keluar
      </button>`;
    }
  } else {
    // --- MODE WARGA UMUM ---
    if (menuInput) menuInput.classList.add('d-none');
    if (menuIpl) menuIpl.classList.add('d-none');
    if (btnLacak) btnLacak.classList.add('d-none');
    if (typeof btnWargaBaru !== 'undefined' && btnWargaBaru) btnWargaBaru.classList.add('d-none');
    if (btnShareWA) btnShareWA.classList.add('d-none'); // Tambahkan baris ini
    if (btnInputIuranBaru) btnInputIuranBaru.classList.add('d-none'); 
    if (btnTambahKegiatan) btnTambahKegiatan.classList.add('d-none'); 
    if (btnBukaInputKeuangan) btnBukaInputKeuangan.classList.add('d-none');

    // --- Sembunyikan tombol cetak untuk Warga Umum ---
    if (btnCetakLaporan) btnCetakLaporan.classList.add('d-none');

    if (areaAuth) {
      areaAuth.innerHTML = `<button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#modalLoginAdmin">
        Login Admin
      </button>`;
    }
  }
  
  if (typeof DB.warga !== 'undefined' && DB.warga.length > 0) {
    loadWarga(); 
  }
}

// --- FUNGSI UNTUK MEMBUKA POP-UP LOGIN ---
function loginAdmin() {
  // Kembalikan tampilan modal ke posisi normal awal
  document.getElementById('inputPinAdmin').value = "";
  document.getElementById('errorPinAdmin').classList.add('d-none');
  document.getElementById('formAksesPin').classList.remove('d-none');
  document.getElementById('footerMdalAdmin').classList.remove('d-none');
  document.getElementById('loadingAksesAdmin').classList.add('d-none');
  
  // Tampilkan modal pop-up
  const modalEl = document.getElementById('modalLoginAdmin');
  const myModal = new bootstrap.Modal(modalEl);
  myModal.show();
}

// --- FUNGSI PROSES VERIFIKASI PIN DARI MODAL + ANIMASI LOADING ---
function prosesLoginAdminModern() {
  const inputPin = document.getElementById('inputPinAdmin');
  const errorMsg = document.getElementById('errorPinAdmin');
  const formAkses = document.getElementById('formAksesPin');
  const footerModal = document.getElementById('footerMdalAdmin');
  const loadingAnim = document.getElementById('loadingAksesAdmin');
  const pin = inputPin.value;

  if (!pin) return; 

  errorMsg.classList.add('d-none'); 

  // Kirim ke server Kode.gs
  google.script.run.withSuccessHandler(hasil => {
    if (hasil.sukses) {
      userRole = 'admin';
      
      // Sembunyikan form PIN dan tombol, lalu ganti dengan Animasi Spinner
      formAkses.classList.add('d-none');
      footerModal.classList.add('d-none');
      loadingAnim.classList.remove('d-none');

      // Jalankan hak akses di latar belakang agar siap dipakai
      aturHakAkses();

      // Berikan jeda animasi loading selama 1.5 detik agar terlihat smooth & natural
      setTimeout(() => {
        const modalEl = document.getElementById('modalLoginAdmin');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
      }, 1500);

    } else {
      // Jika PIN salah, tampilkan teks error tanpa mengganggu form
      errorMsg.classList.remove('d-none');
      inputPin.focus();
    }
  }).verifikasiPINAdmin(pin);
}


// --- FUNGSI TOMBOL KELUAR ADMIN (VERSI AMAN & ANTI MACET) ---
function logoutAdmin() {
  try {
    // 1. Jalankan fungsi utama penguncian role aplikasi Anda
    userRole = 'warga'; 
    if (typeof aturHakAkses === "function") {
      aturHakAkses(); // Menutup dan mengunci menu pengurus di web secara instan
    }

    // 2. Coba tampilkan animasi loading logout secara aman
    const modalEl = document.getElementById('modalLoginAdmin');
    if (modalEl) {
      // Sembunyikan elemen form login di dalam modal jika elemennya ada
      const formPin = document.getElementById('formAksesPin');
      const footerM = document.getElementById('footerMdalAdmin');
      const loadAkses = document.getElementById('loadingAksesAdmin');
      const loadKeluar = document.getElementById('loadingKeluarAdmin');
      
      if (formPin) formPin.classList.add('d-none');
      if (footerM) footerM.classList.add('d-none');
      if (loadAkses) loadAkses.classList.add('d-none');
      if (loadKeluar) loadKeluar.classList.remove('d-none');

      // Tampilkan modal ke layar
      const myModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      myModal.show();

      // Jeda 1.5 detik lalu tutup modal dan bersihkan form untuk login berikutnya
      setTimeout(() => {
        myModal.hide();
        
        setTimeout(() => {
          const inputPin = document.getElementById('inputPinAdmin');
          if (inputPin) inputPin.value = "";
          if (formPin) formPin.classList.remove('d-none');
          if (footerM) footerM.classList.remove('d-none');
          if (loadKeluar) loadKeluar.classList.add('d-none');
        }, 400);
      }, 1500);
      
    } else {
      // Jalur Cadangan: Jika elemen modal tidak ditemukan/error, langsung alert biasa agar admin tetap bisa keluar
      alert("Sistem Dikunci. Anda telah keluar dari mode Pengurus.");
    }

  } catch (err) {
    console.error("Gagal logout via animasi, melakukan fallback otomatis:", err);
    userRole = 'warga';
    if (typeof aturHakAkses === "function") aturHakAkses();
  }
}

// --- FUNGSI REKAP IPL (BERBASIS WARGA BLOK & FOKUS FISIK MASUK) ---
function hitungLaporanIPL() {
  const blnIPL = document.getElementById('fBulanIPL').value; 
  const tbodyIPL = document.getElementById('tbl-ipl-body');
  
  // Element penampung total di layar aplikasi
  const txtSeharusnya = document.getElementById('total-seharusnya-ipl');
  const txtTerkumpul = document.getElementById('total-terkumpul-ipl');

  // Element penampung total khusus layar cetak PRINT / PDF
  const printSeharusnya = document.getElementById('print-seharusnya-ipl');
  const printTerkumpul = document.getElementById('print-terkumpul-ipl');
  const printWargaLunas = document.getElementById('print-warga-lunas');
  const printWargaBelum = document.getElementById('print-warga-belum');

  // Antisipasi jika bulan belum dipilih
  if (!blnIPL) {
    tbodyIPL.innerHTML = '<tr><td colspan="6" class="text-center p-3">Silakan pilih bulan transaksi terlebih dahulu.</td></tr>';
    if (txtSeharusnya) txtSeharusnya.innerText = 'Rp 0';
    if (txtTerkumpul) txtTerkumpul.innerText = 'Rp 0';
    if (printSeharusnya) printSeharusnya.innerText = 'Rp 0';
    if (printTerkumpul) printTerkumpul.innerText = 'Rp 0';
    if (printWargaLunas) printWargaLunas.innerText = '0';
    if (printWargaBelum) printWargaBelum.innerText = '0';
    return;
  }

  // 1. FILTER WARGA: Hanya ambil warga dari DB.warga yang dilaporkan ke blok (IPL === 'YA')
  const wargaWajibIPL = DB.warga.filter(w => 
    w.IPL && w.IPL.trim().toUpperCase() === 'YA'
  );

  if (wargaWajibIPL.length === 0) {
    tbodyIPL.innerHTML = '<tr><td colspan="6" class="text-center p-3 text-muted">Tidak ada data warga wajib IPL.</td></tr>';
    if (txtSeharusnya) txtSeharusnya.innerText = 'Rp 0';
    if (txtTerkumpul) txtTerkumpul.innerText = 'Rp 0';
    if (printSeharusnya) printSeharusnya.innerText = 'Rp 0';
    if (printTerkumpul) printTerkumpul.innerText = 'Rp 0';
    if (printWargaLunas) printWargaLunas.innerText = '0';
    if (printWargaBelum) printWargaBelum.innerText = '0';
    return;
  }

  let htmlRows = "";
  let akumulasiSeharusnya = 0; 
  let akumulasiTerkumpul = 0; 
  let jmlLunas = 0;
  let jmlBelum = 0;

  // 2. Loop data warga aktif hasil filter di atas
  wargaWajibIPL.forEach((w, index) => {
    const namaWarga = w.Nama;
    const alamatWarga = w.Alamat || '-';
    
    // AMBIL STATUS MENETAP / BELUM LANGSUNG DARI DATABASE WARGA
    const statusWarga = w.Status ? w.Status.trim() : "-";

    // Cari nominal wajib bulanan dari sheet pendaftaran (Default 50rb jika data kosong)
    const infoDaftar = DB.pendaftaran.find(p => p.Nama_Warga === namaWarga && p.Jenis_Iuran === "IPL");
    // Di sini nominalWajib otomatis menangkap angka 0 jika dia digratiskan/pengurus
    const nominalWajib = infoDaftar ? Number(infoDaftar.Nominal || 0) : 50000;

    // A. Hitung nominal setor riil bulan ini berdasarkan TANGGAL setor/transfer (p.Tanggal)
    const transaksiMasukBulanIni = DB.pemasukan.filter(p => 
      p.Nama === namaWarga && 
      p.Jenis && p.Jenis.trim().toUpperCase() === "IPL" && 
      p.Tanggal && p.Tanggal.substring(0, 7) === blnIPL
    );
    let nominalSetorBulanIni = transaksiMasukBulanIni.reduce((s, i) => s + Number(i.Jumlah || 0), 0);

    // B. Cari data target bulan tagihan ini khusus untuk menentukan status teks LUNAS/BELUM
    const statusPembayaranTagihan = DB.pemasukan.find(p => 
      p.Nama === namaWarga && 
      p.Jenis && p.Jenis.trim().toUpperCase() === "IPL" && 
      p.Bulan === blnIPL
    );

    let statusFix = "";
    let badgeClass = "";
    let bgRow = "";

    // Cek Status dan hitung summary jumlah warga
    if (nominalWajib === 0) {
      statusFix = "LUNAS";
      badgeClass = "bg-info"; 
      jmlLunas++; 
    } else if (statusPembayaranTagihan) {
      // --- PENANDA KHUSUS BAYAR DOBEL / RAPEL ---
      if (nominalSetorBulanIni > nominalWajib) {
        statusFix = "LUNAS (DOBEL)";
        badgeClass = "bg-primary"; // Menggunakan warna biru tua agar beda dari lunas biasa
      } else {
        statusFix = "LUNAS";
        badgeClass = "bg-success"; // Warna hijau untuk lunas normal
      }
      jmlLunas++; 
    } else {
      statusFix = "BELUM";
      badgeClass = "bg-danger";
      bgRow = "table-danger";
      jmlBelum++; 
    }

    // 3. LOGIKA MATEMATIS PERBAIKAN:
    // Akumulasi Seharusnya (Target): Murni sum dari ketentuan awal nominalWajib (0 atau 50000)
    akumulasiSeharusnya += nominalWajib;

    // Akumulasi Terkumpul (Fisik Uang): Tambahkan berapa pun nominal uang fisik yang masuk bulan ini
    akumulasiTerkumpul += nominalSetorBulanIni;

    // Susun baris tabel HTML (Kolom ke-5 sekarang menggunakan statusWarga)
    htmlRows += `
      <tr class="${bgRow}">
        <td class="text-center">${index + 1}</td>
        <td><strong>${namaWarga}</strong></td>
        <td><small>${alamatWarga}</small></td>
        <td class="text-center"><span class="badge ${badgeClass}">${statusFix}</span></td>
        <td class="text-center fw-bold text-secondary">${statusWarga}</td>
        <td class="text-end fw-bold ${nominalSetorBulanIni > 0 ? 'text-success' : (nominalWajib === 0 ? 'text-secondary' : 'text-danger')}">
          Rp ${nominalSetorBulanIni.toLocaleString('id-ID')}
        </td>
      </tr>
    `;
  });

  // Cetak seluruh baris data ke tabel HTML
  tbodyIPL.innerHTML = htmlRows;
  
  // Update teks total di layar aplikasi utama
  if (txtSeharusnya) txtSeharusnya.innerText = `Rp ${akumulasiSeharusnya.toLocaleString('id-ID')}`;
  if (txtTerkumpul) txtTerkumpul.innerText = `Rp ${akumulasiTerkumpul.toLocaleString('id-ID')}`;

  // Update teks rekap khusus untuk cetakan area Print/PDF secara real-time
  if (printSeharusnya) printSeharusnya.innerText = `Rp ${akumulasiSeharusnya.toLocaleString('id-ID')}`;
  if (printTerkumpul) printTerkumpul.innerText = `Rp ${akumulasiTerkumpul.toLocaleString('id-ID')}`;
  if (printWargaLunas) printWargaLunas.innerText = jmlLunas;
  if (printWargaBelum) printWargaBelum.innerText = jmlBelum;
}

// --- FUNGSI UNTUK MEMBUKA DIALOG PRINT / SAVE PDF TAB IPL ---
function cetakLaporanIPL() {
  const blnIPL = document.getElementById('fBulanIPL').value;

  if (!blnIPL) {
    alert("Silakan pilih bulan transaksi terlebih dahulu sebelum mencetak!");
    return;
  }

  const totalSeharusnya = document.getElementById('total-seharusnya-ipl').innerText;
  const totalTerkumpul  = document.getElementById('total-terkumpul-ipl').innerText;

  const opsiBulan = new Date(blnIPL + "-01").toLocaleDateString('id-ID', {
    month: 'long',
    year:  'numeric'
  });

  document.getElementById('print-periode-ipl').innerText    = "Periode: " + opsiBulan;
  document.getElementById('print-seharusnya-ipl').innerText = totalSeharusnya;
  document.getElementById('print-terkumpul-ipl').innerText  = totalTerkumpul;

  if (typeof AndroidPrint !== 'undefined') {
    try {
      AndroidPrint.performPrintHtml(document.documentElement.outerHTML);
    } catch (e) {
      alert("Gagal mencetak: " + e.message);
    }
  } else {
    window.print();
  }
}

// --- FUNGSI MENAMPILKAN DAFTAR KEGIATAN WARGA (FRONTEND) ---
function tampilkanListKegiatan() {
  const container = document.getElementById('list-kegiatan-warga');
  const containerMendatang = document.getElementById('container-kegiatan-mendatang'); // Target body tabel di Home
  const containerSelesai = document.getElementById('container-kegiatan-selesai');       // Target body tabel di Home
  
  if (!container) return;

  if (!DB.kegiatan || DB.kegiatan.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted p-4">Belum ada catatan kegiatan warga Lorong 9.</div>';
    if (containerMendatang) containerMendatang.innerHTML = '<tr><td colspan="4" class="text-center text-muted small py-3">Tidak ada kegiatan mendatang dekat-dekat ini.</td></tr>';
    if (containerSelesai) containerSelesai.innerHTML = '<tr><td colspan="4" class="text-center text-muted small py-3">Belum ada kegiatan yang selesai di bulan ini.</td></tr>';
    return;
  }

  // Ambil waktu hari ini untuk komparasi tanggal (reset jam ke 00:00)
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  const bulanIni = hariIni.getMonth();
  const tahunIni = hariIni.getFullYear();

  // Urutkan kegiatan berdasarkan tanggal terbaru
  const kegiatanSorted = [...DB.kegiatan].sort((a, b) => new Date(b.Tanggal) - new Date(a.Tanggal));

  // KUNCI PERBAIKAN: Berikan pembuka <div class="row g-3"> langsung di sini agar tidak merusak elemen luar
  let htmlAllCards = '<div class="row g-3">'; 
  let htmlMendatangRows = "";
  let htmlSelesaiRows = "";

  kegiatanSorted.forEach(k => {
    const tglKegiatan = new Date(k.Tanggal);
    const tglKegiatanReset = new Date(k.Tanggal);
    tglKegiatanReset.setHours(0, 0, 0, 0);

    const tglIndo = tglKegiatan.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const imgUrl = k.Link_Foto ? k.Link_Foto : 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=500';
    const isMendatang = tglKegiatanReset > hariIni;

    const originalIndex = DB.kegiatan.indexOf(k);

    const btnEditHtml = (typeof userRole !== 'undefined' && userRole === "admin") ? 
      `<button class="btn btn-sm btn-outline-primary py-1 px-2 m-0" style="font-size: 0.7rem; border-radius: 8px;" onclick="bukaModalEditKegiatan(${originalIndex})">
         <i class="bi bi-pencil-square"></i> Edit
       </button>` : '';

    // ==========================================
    // AREA A: TAMPILAN CARD BESAR (TAB KEGIATAN) - DESIGN AMAN
    // ==========================================
    let badgeComingSoon = "";
    if (isMendatang) {
      badgeComingSoon = `<span class="badge bg-warning text-dark position-absolute top-0 start-0 m-1 shadow-sm" style="font-size: 0.6rem; z-index: 2;">Coming Soon</span>`;
    }

    htmlAllCards += `
      <div class="col-12 col-md-6">
        <div class="card border-0 shadow-sm" style="border-radius: 12px; overflow: hidden;">
          <div class="row g-0">
            <div class="col-5 position-relative bg-light" style="min-height: 110px;">
              ${badgeComingSoon}
              <img src="${imgUrl}" class="w-100 h-100 object-fit-cover position-absolute start-0 top-0" alt="Foto" onerror="this.src='https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=500'">
            </div>
            <div class="col-7 bg-white">
              <div class="card-body p-2 px-3 d-flex flex-column justify-content-between h-100" style="min-height: 110px;">
                <div>
                  <small class="text-primary fw-bold d-block mb-1" style="font-size: 0.7rem;">
                    <i class="bi bi-calendar-event me-1"></i> ${tglIndo}
                  </small>
                  <h6 class="card-title fw-bolder text-dark mb-1 lh-sm" style="font-size: 0.9rem;">
                    ${k.Jenis_Kegiatan}
                  </h6>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2 pt-1 border-top">
                  <small class="text-muted fw-semibold" style="font-size: 0.7rem;">
                    <i class="bi bi-people-fill me-1"></i> ${k.Jumlah_Partisipasi} Orang
                  </small>
                  ${btnEditHtml}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // ==========================================
    // AREA B: TAMPILAN LIST TABEL (TAB HOME)
    // ==========================================
    const rowHtml = '<tr><td class="text-center align-middle" style="width: 45px;"><img src="' + imgUrl + '" class="rounded border shadow-sm" style="width: 28px; height: 28px; object-fit: cover;" onerror="this.src=\'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=500\'"></td><td class="small text-secondary align-middle" style="white-space: nowrap;">' + tglIndo + '</td><td class="fw-bold text-dark small align-middle">' + k.Jenis_Kegiatan + (isMendatang ? ' <span class="badge bg-warning text-dark ms-1" style="font-size: 9px; padding: 2px 4px;">Coming Soon</span>' : '') + '</td><td class="small text-dark align-middle text-start" style="white-space: nowrap;"><i class="bi bi-people-fill text-muted me-1"></i><strong>' + k.Jumlah_Partisipasi + '</strong> Warga</td></tr>';

    if (isMendatang) {
      htmlMendatangRows += rowHtml;
    } else if (tglKegiatan.getMonth() === bulanIni && tglKegiatan.getFullYear() === tahunIni) {
      htmlSelesaiRows += rowHtml;
    }
  });

  // KUNCI PERBAIKAN: Tutup tag div row untuk kartu kegiatan
  htmlAllCards += '</div>';

  // Tampilkan data hasil render ke wadah masing-masing tanpa manipulasi tambahan
  container.innerHTML = htmlAllCards;
  
  if (containerMendatang) {
    containerMendatang.innerHTML = htmlMendatangRows || '<tr><td colspan="4" class="text-center text-muted small py-3">Tidak ada kegiatan mendatang dekat-dekat ini.</td></tr>';
  }
  if (containerSelesai) {
    containerSelesai.innerHTML = htmlSelesaiRows || '<tr><td colspan="4" class="text-center text-muted small py-3">Belum ada kegiatan yang selesai di bulan ini.</td></tr>';
  }

  // Pengatur Tombol Admin Tambah Kegiatan
  const btnTambah = document.getElementById('btn-tambah-kegiatan');
  if (btnTambah) {
    if (typeof userRole !== 'undefined' && userRole === "admin") { 
       btnTambah.classList.remove('d-none');
    } else {
       btnTambah.classList.add('d-none');
    }
  }
}

// --- LOGIKA MENGIRIM DATA FORM KEGIATAN BARU (FRONTEND) ---
document.addEventListener("DOMContentLoaded", function() {

  // --- KONTROL NAVIGASI LAYAR LOGIN & TAMU ---

// =========================================================
  // KODE BARU: Memuat Konten Tamu Secara Aman Tanpa Error HTML
  // =========================================================
  google.script.run.withSuccessHandler(function(htmlKonten) {
    const wadahTab = document.getElementById('tab-project');
    if (wadahTab) {
      wadahTab.innerHTML = htmlKonten;
    }
  }).ambilHtmlTamu();
  // =========================================================
  
// Munculkan input sandi saat opsi warga diklik
function tampilkanFormSandi() {
  document.getElementById('box-input-sandi').classList.remove('d-none');
}

// Tombol Batal input sandi
function kembaliKeMenuAwal() {
  document.getElementById('box-input-sandi').classList.add('d-none');
  document.getElementById('form-sandi-akses').reset();
  document.getElementById('sandi-alert').classList.add('d-none');
}

// =========================================================
  // KODE BARU: TOMBOL TAMU & VERIFIKASI LOGIN
  // =========================================================
  
  // 1. Opsi jika memilih "Lihat sebagai Tamu"
  const btnTamu = document.getElementById('btn-akses-tamu');
  if (btnTamu) {
    btnTamu.addEventListener('click', function() {
      userRole = "tamu";
      document.getElementById('welcome-screen').classList.add('d-none');
      document.getElementById('tamu-screen').classList.remove('d-none');
      if (typeof muatDataProjectTamu === "function") {
        muatDataProjectTamu();
      }
    });
  }

  // 2. Opsi jika melakukan Verifikasi Sandi Warga/Admin
  const formSandi = document.getElementById('form-sandi-akses');
  if (formSandi) {
    formSandi.addEventListener('submit', function(e) {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-sandi');
      const alertBox = document.getElementById('sandi-alert');
      const sandiInput = document.getElementById('input_password_app').value;

      submitBtn.disabled = true;
      submitBtn.innerText = "Memeriksa...";
      alertBox.classList.add('d-none');

      google.script.run.withSuccessHandler(function(response) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Verifikasi";

        if (response.success) {
          userRole = response.role;
          document.getElementById('welcome-screen').classList.add('d-none');
          document.getElementById('dash-content').classList.remove('d-none');
          
          // Memanggil fungsi dashboard internal milik Anda
          // loadDashboard(); 
        } else {
          alertBox.innerText = response.message;
          alertBox.classList.remove('d-none');
        }
      }).verifikasiSandiAplikasi(sandiInput);
    });
  }
  

// =========================================================
  // TARUH KODE TAMU DI SINI (Di bawah baris 1275 Anda)
  // =========================================================
  const btnAksesTamu = document.getElementById('btn-akses-tamu');
  if (btnAksesTamu) {
    btnAksesTamu.addEventListener('click', function() {
      userRole = "tamu";
      document.getElementById('welcome-screen').classList.add('d-none');
      document.getElementById('tamu-screen').classList.remove('d-none');
      
      // Panggil fungsi untuk mengambil data project dari spreadsheet
      muatDataProjectTamu(); 
    });
  }

// Fungsi kembali dari halaman Tamu ke menu login utama
function logoutAplikasi() {
  // Sembunyikan dashboard atau layar tamu
  document.getElementById('tamu-screen').classList.add('d-none');
  document.getElementById('dash-content').classList.add('d-none');
  
  // Tampilkan layar selamat datang awal
  document.getElementById('welcome-screen').classList.remove('d-none');
  
  // Reset form sandi jika ada sisa inputan
  kembaliKeMenuAwal();
}

// Pasang Listener Event setelah DOM selesai dimuat
document.addEventListener("DOMContentLoaded", function() {
  
  // A. EVENT JIKA PILIH "LIHAT SEBAGAI TAMU"
  const btnTamu = document.getElementById('btn-akses-tamu');
  if (btnTamu) {
    btnTamu.addEventListener('click', function() {
      userRole = "tamu";
      
      // Sembunyikan login screen, tampilkan layar kustom tamu
      document.getElementById('welcome-screen').classList.add('d-none');
      document.getElementById('tamu-screen').classList.remove('d-none');
    });
  }

  // B. EVENT VERIFIKASI SANDI (WARGA / ADMIN)
  const formSandi = document.getElementById('form-sandi-akses');
  if (formSandi) {
    formSandi.addEventListener('submit', function(e) {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-sandi');
      const alertBox = document.getElementById('sandi-alert');
      const sandiInput = document.getElementById('input_password_app').value;

      submitBtn.disabled = true;
      submitBtn.innerText = "Memeriksa...";
      alertBox.classList.add('d-none');

      // Panggil fungsi pencocokan password di Kode.gs Anda
      google.script.run.withSuccessHandler(function(response) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Verifikasi";

        if (response.success) {
          userRole = response.role; // Menyimpan data "admin" atau "warga"
          
          // Masuk ke dashboard internal warga/admin
          document.getElementById('welcome-screen').classList.add('d-none');
          document.getElementById('dash-content').classList.remove('d-none');
          
          // Jalankan pengecekan hak tombol admin/warga yang sudah Anda buat sebelumnya
          if (typeof aturHakAkses === "function") aturHakAkses();
          if (typeof loadDashboard === "function") loadDashboard();
        } else {
          alertBox.innerText = response.message;
          alertBox.classList.remove('d-none');
        }
      }).verifikasiSandiAplikasi(sandiInput); // Pastikan fungsi ini sudah terpasang di Kode.gs
    });
  }
});


  
  // PERBAIKAN 1: Pindahkan listener tombol "Tambah" keluar dari submit form agar jalurnya benar
  const btnTambahKeg = document.getElementById('btn-tambah-kegiatan');
  if (btnTambahKeg) {
    btnTambahKeg.addEventListener('click', function() {
      editRowIndex = null; // Kembalikan ke mode tambah baru
      document.getElementById('form-kegiatan').reset();
      document.querySelector('#modalKegiatan .modal-title').innerText = "Tambah Kegiatan Baru";
      document.querySelector('#form-kegiatan button[type="submit"]').innerText = "Simpan Kegiatan";
    });
  }

  // Event Listener Utama untuk Submit Form
  const formKeg = document.getElementById('form-kegiatan');
  if(formKeg) {
    formKeg.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const submitBtn = this.querySelector('button[type="submit"]');
      
      // PERBAIKAN 2: Definisikan kembali variabel komponen file foto yang sebelumnya hilang
      const fileInput = document.getElementById('keg_foto');
      const file = fileInput ? fileInput.files[0] : null; 
      
      // Pastikan editRowIndex sudah terdefinisi sebelum dikirim
      const payload = {
        index: (typeof editRowIndex !== 'undefined') ? editRowIndex : null, 
        tanggal: document.getElementById('keg_tanggal').value,
        jenis: document.getElementById('keg_nama').value,
        partisipasi: document.getElementById('keg_partisipasi').value,
        fileBase64: null,
        fileName: null,
        fileMimeType: null,
        existingFoto: (typeof editRowIndex !== 'undefined' && editRowIndex !== null && DB.kegiatan[editRowIndex]) ? DB.kegiatan[editRowIndex].Link_Foto : null
      };

      // Berikan efek loading pada tombol agar user tahu proses sedang berjalan
      submitBtn.disabled = true;
      submitBtn.innerText = (payload.index !== null) ? "Mengupdate Data..." : "Menyimpan...";

      // Jalankan pengecekan file foto
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          const result = event.target.result; 
          payload.fileBase64 = result.split(',')[1]; 
          payload.fileName = "Kegiatan_" + new Date().getTime() + "_" + file.name;
          payload.fileMimeType = file.type;
          
          kirimDataKegiatanKeServer(payload, submitBtn);
        };
        reader.readAsDataURL(file); 
      } else {
        kirimDataKegiatanKeServer(payload, submitBtn);
      }
    });
  }
});

function kirimDataKegiatanKeServer(payload, submitBtn) {
  // Tentukan fungsi mana yang akan dipanggil di Kode.gs
  const fungsiServer = (payload.index !== null) ? "editKegiatanLama" : "simpanKegiatanBaru";

  google.script.run.withSuccessHandler(function(response) {
    submitBtn.disabled = false;
    submitBtn.innerText = "Simpan Kegiatan";

    if (response.success) {
      alert(response.message);
      
      // --- LOGIKA PENCEGAHAN DUPLIKASI ---
      if (payload.index !== null) {
        // MODE EDIT: Timpa data lama, JANGAN gunakan push()
        DB.kegiatan[payload.index] = {
          Tanggal: payload.tanggal,
          Jenis_Kegiatan: payload.jenis,
          Jumlah_Partisipasi: payload.partisipasi,
          Link_Foto: response.newFotoUrl || payload.existingFoto
        };
      } else {
        // MODE TAMBAH BARU: Baru gunakan push()
        DB.kegiatan.push({
          Tanggal: payload.tanggal,
          Jenis_Kegiatan: payload.jenis,
          Jumlah_Partisipasi: payload.partisipasi,
          Link_Foto: response.newFotoUrl
        });
      }

      tampilkanListKegiatan(); // Refresh tampilan
      tutupDanResetModalKegiatan(); // Tutup modal
    } else {
      alert("Gagal: " + response.message);
    }
  })[fungsiServer](payload); // Memanggil fungsi server secara dinamis
}

// Fungsi tambahan untuk bersih-bersih
function tutupDanResetModalKegiatan() {
  document.getElementById('form-kegiatan').reset();
  editRowIndex = null; // Reset index ke null
  const modalEl = document.getElementById('modalKegiatan');
  const modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (modalInstance) modalInstance.hide();
}

let modalIuranObj;

// Fungsi Utama saat Tombol "+ Iuran Baru" diklik admin
function bukaModalTambahIuran() {
  document.getElementById('formTambahIuran').reset();
  
  // Kembalikan ke Tab Utama pertama (Form Iuran Baru)
  const tabCtrl = document.getElementById('tab-baru-ctrl');
  if (tabCtrl) {
    const actTab = new bootstrap.Tab(tabCtrl);
    actTab.show();
  }
  
  toggleSubAksiIuran();
  populateIuranDropdowns();
  renderSemuaChecklistWarga();
  
  const modalObj = new bootstrap.Modal(document.getElementById('modalTambahIuran'));
  modalObj.show();
}

// Mengatur visibility field Input Skema berdasarkan pilihan Radio Button
function toggleSubAksiIuran() {
  const isInputBaru = document.getElementById('radInputIuranBaru').checked;
  if (isInputBaru) {
    document.getElementById('wrapper-skema-baru').classList.remove('d-none');
    document.getElementById('wrapper-iuran-eksisting').classList.add('d-none');
    document.getElementById('mSelectIuranEksisting').value = "";
    renderSemuaChecklistWarga();
  } else {
    document.getElementById('wrapper-skema-baru').classList.add('d-none');
    document.getElementById('wrapper-iuran-eksisting').classList.remove('d-none');
    updateChecklistWargaEksisting();
  }
}

// Membaca DB.pendaftaran untuk ditaruh di Dropdown Pilihan Iuran
function populateIuranDropdowns() {
  if (!DB.pendaftaran) return;
  const listIuranUnik = [...new Set(DB.pendaftaran.map(p => p.Jenis_Iuran))].filter(Boolean);
  
  let htmlOpts = '<option value="">-- Pilih Iuran --</option>';
  listIuranUnik.forEach(item => {
    htmlOpts += `<option value="${item}">${item}</option>`;
  });
  
  document.getElementById('mSelectIuranEksisting').innerHTML = htmlOpts;
  document.getElementById('mSelectEditIuran').innerHTML = htmlOpts;
}

// Menampilkan checklist warga polosan (kosong/belum terdaftar untuk skema iuran baru)
function renderSemuaChecklistWarga() {
  const tbody = document.getElementById('tbl-warga-checklist-body');
  tbody.innerHTML = '';
  document.getElementById('checkAllWarga').checked = false;
  
  DB.warga.forEach(w => {
    tbody.innerHTML += `
      <tr>
        <td class="text-center"><input type="checkbox" class="check-warga-baru" value="${w.Nama}"></td>
        <td>${w.Nama}</td>
        <td><span class="badge bg-secondary">Belum Terdaftar</span></td>
      </tr>
    `;
  });
}

// Mengubah status checklist warga jika memilih Tambah Peserta Iuran Eksisting
function updateChecklistWargaEksisting() {
  const namaIuran = document.getElementById('mSelectIuranEksisting').value;
  const tbody = document.getElementById('tbl-warga-checklist-body');
  tbody.innerHTML = '';
  document.getElementById('checkAllWarga').checked = false;
  
  if (!namaIuran) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Silakan pilih jenis iuran.</td></tr>';
    return;
  }
  
  // Cari list warga yang sudah terdaftar di iuran ini
  const wargaTerdaftar = DB.pendaftaran
    .filter(p => p.Jenis_Iuran === namaIuran && p.Status_Keikutsertaan && p.Status_Keikutsertaan.trim().toLowerCase() === 'ikut')
    .map(p => p.Nama_Warga || p.Nama);
    
  DB.warga.forEach(w => {
    const sudahAda = wargaTerdaftar.includes(w.Nama);
    const cbChecked = sudahAda ? 'checked' : '';
    const cbDisabled = sudahAda ? 'disabled' : '';
    const statusLabel = sudahAda ? '<span class="badge bg-success">Sudah Peserta</span>' : '<span class="badge bg-warning text-dark">Belum Terdaftar</span>';
    
    tbody.innerHTML += `
      <tr>
        <td class="text-center">
          <input type="checkbox" class="check-warga-baru" value="${w.Nama}" ${cbChecked} ${cbDisabled}>
        </td>
        <td>${w.Nama}</td>
        <td>${statusLabel}</td>
      </tr>
    `;
  });
}

function toggleAllWarga(master) {
  const cbs = document.querySelectorAll('.check-warga-baru');
  cbs.forEach(cb => { if (!cb.disabled) cb.checked = master.checked; });
}

function initTabEditIuran() {
  document.getElementById('mSelectEditIuran').value = "";
  document.getElementById('tbl-peserta-edit-body').innerHTML = '<tr><td colspan="3" class="text-center text-muted p-3">Silakan pilih jenis iuran terlebih dahulu untuk memuat data warga.</td></tr>';
}

// Memuat daftar peserta di Tab Edit Iuran untuk aksi Hapus Kepesertaan
function loadPesertaIuranEdit() {
  const namaIuran = document.getElementById('mSelectEditIuran').value;
  const tbody = document.getElementById('tbl-peserta-edit-body');
  tbody.innerHTML = '';
  
  if (!namaIuran) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted p-3">Silakan pilih jenis iuran terlebih dahulu.</td></tr>';
    return;
  }
  
  const listPeserta = DB.pendaftaran.filter(p => p.Jenis_Iuran === namaIuran && p.Status_Keikutsertaan && p.Status_Keikutsertaan.trim().toLowerCase() === 'ikut');
  
  if (listPeserta.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-warning p-3">Tidak ada peserta aktif di iuran ini.</td></tr>';
    return;
  }
  
  listPeserta.forEach((p, idx) => {
    const nama = p.Nama_Warga || p.Nama;
    tbody.innerHTML += `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td class="fw-bold text-dark">${nama}</td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-outline-danger shadow-sm px-2 py-1" onclick="hapusKepesertaanWarga('${nama}', '${namaIuran}')" style="font-size:11px;">
            <i class="bi bi-trash3 me-1"></i> Hapus Peserta
          </button>
        </td>
      </tr>
    `;
  });
}

// Aksi Submit Menyimpan Form Tab 1 ke Spreadsheet
function simpanIuranFormBaru() {
  const isSkemaBaru = document.getElementById('radInputIuranBaru').checked;
  let payload = {};
  
  // Ambil data checklist yang valid dicentang (bukan data lama/disabled)
  const checkboxes = document.querySelectorAll('.check-warga-baru');
  let wargaTerpilih = [];
  checkboxes.forEach(cb => {
    if (cb.checked && !cb.disabled) wargaTerpilih.push(cb.value);
  });
  
  if (wargaTerpilih.length === 0) {
    alert("Mohon centang warga yang ingin didaftarkan!");
    return;
  }
  
  if (isSkemaBaru) {
    const jenis = document.getElementById('mJenisIuran').value.trim();
    const nominal = document.getElementById('mNominal').value;
    const bulan = document.getElementById('mMulaiBulan').value;
    const sifat = document.getElementById('mSifat').value;
    
    if (!jenis || !nominal || !bulan || !sifat) {
      alert("Semua data iuran baru wajib diisi secara lengkap!");
      return;
    }
    
    payload = { aksi: 'skema_baru', jenis: jenis, nominal: nominal, bulan: bulan, sifat: sifat, warga: wargaTerpilih };
  } else {
    const jenisLama = document.getElementById('mSelectIuranEksisting').value;
    if (!jenisLama) {
      alert("Pilih iuran eksisting terlebih dahulu!");
      return;
    }
    payload = { aksi: 'tambah_peserta', jenis: jenisLama, warga: wargaTerpilih };
  }
  
  document.body.style.cursor = 'wait';
  google.script.run.withSuccessHandler(res => {
    document.body.style.cursor = 'default';
    if (res.success) {
      alert(res.message);
      location.reload();
    } else {
      alert("Peringatan: " + res.message);
    }
  }).backendProsesManajemenIuran(payload);
}

// Aksi Menghapus Peserta di Tab 2 dari Spreadsheet
function hapusKepesertaanWarga(namaWarga, namaIuran) {
  if (!confirm(`Apakah Anda yakin ingin menghapus ${namaWarga} dari daftar kepesertaan ${namaIuran}?`)) return;
  
  document.body.style.cursor = 'wait';
  google.script.run.withSuccessHandler(res => {
    document.body.style.cursor = 'default';
    if (res.success) {
      alert(res.message);
      location.reload();
    } else {
      alert("Gagal menghapus: " + res.message);
    }
  }).backendProsesHapusPeserta({ nama: namaWarga, jenis: namaIuran });
}

let editRowIndex = null; // Penanda global (null = Mode Tambah, Angka = Mode Edit)

// Fungsi untuk membuka modal dan otomatis mengisi data lama
function bukaModalEditKegiatan(index) {
  const k = DB.kegiatan[index];
  editRowIndex = index; // Kunci indeks data yang mau diedit

  // Mengubah format Tanggal agar sesuai dengan input type="date" (YYYY-MM-DD)
  let tglForm = "";
  if (k.Tanggal) {
    const d = new Date(k.Tanggal);
    tglForm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Isi otomatis (Auto-fill) Form dengan data lama
  document.getElementById('keg_tanggal').value = tglForm;
  document.getElementById('keg_nama').value = k.Jenis_Kegiatan;
  document.getElementById('keg_partisipasi').value = k.Jumlah_Partisipasi;

  // Ubah Teks UI Modal secara dinamis menjadi mode Edit
  document.querySelector('#modalKegiatan .modal-title').innerText = "Edit Catatan Kegiatan";
  document.querySelector('#form-kegiatan button[type="submit"]').innerText = "Update & Simpan Perubahan";

  // Tampilkan Modal Form Kegiatan
  const modalEl = document.getElementById('modalKegiatan');
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

// -- PROJECT --
// Fungsi untuk mengambil data dari server Google Sheet
function muatDataProjectTamu() {
  const container = document.getElementById('container-project-tamu');
  
  google.script.run.withSuccessHandler(function(response) {
    if (response.success) {
      // Bersihkan loading spinner atau data lama
      container.innerHTML = ""; 
      
      if (response.data.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-4 w-100">Belum ada project yang didaftarkan.</div>`;
        return;
      }
      
      // Susun data ke bawah menggunakan looping
      response.data.forEach(function(proj) {
        // Cek jika link gambar kosong, gunakan gambar placeholder default
        const fotoUrl = proj.gambar ? proj.gambar : "https://placehold.co/600x400?text=No+Image";
        
        const cardHtml = `
          <div class="col">
            <div class="card h-100 shadow-sm border-0 overflow-hidden">
              <div class="row g-0">
                <div class="col-md-4">
                  <img src="${fotoUrl}" class="img-fluid h-100 w-100 text-center" style="object-fit: cover; min-height: 200px;" alt="${proj.jenis}">
                </div>
                <div class="col-md-8">
                  <div class="card-body d-flex flex-column h-100 justify-content-center p-4">
                    <h4 class="card-title fw-bold text-primary mb-2">${proj.jenis}</h4>
                    <p class="card-text text-secondary" style="text-align: justify; white-space: pre-line;">${proj.deskripsi}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        // Masukkan susunan card baru ke dalam kontainer utama
        container.insertAdjacentHTML('beforeend', cardHtml);
      });
    } else {
      container.innerHTML = `<div class="alert alert-danger w-100">Gagal memuat data: ${response.message}</div>`;
    }
  }).ambilDataProject();
}

function logoutAplikasi() {
  document.getElementById('tamu-screen').classList.add('d-none');
  document.getElementById('dash-content').classList.add('d-none');
  document.getElementById('welcome-screen').classList.remove('d-none');

  const formSandi = document.getElementById('form-sandi-akses');
  if (formSandi) formSandi.reset();

  const alertBox = document.getElementById('sandi-alert');
  if (alertBox) alertBox.classList.add('d-none');

  const boxSandi = document.getElementById('box-input-sandi');
  if (boxSandi) boxSandi.classList.add('d-none');
}

// =========================================================
// FUNGSI CETAK LAPORAN KEUANGAN PDF (TERMASUK FITUR TUNGGAKAN WARGA)
// =========================================================
function cetakLaporanKeuangan() {
  // --- TAMBAHKAN PENGECEKAN HAK AKSES DI SINI ---
  // Pastikan variabel userRole sudah terdefinisi di aplikasi Anda
  if (typeof userRole === 'undefined' || userRole !== 'admin') {
    alert("Maaf, fitur cetak laporan hanya tersedia untuk Admin.");
    return; // Berhenti di sini, fungsi tidak dijalankan
  }
  
  // Lanjutkan dengan kode yang sudah kita buat sebelumnya...
  const bln = document.getElementById('fKeuBulan').value;
  if (!bln) {
    alert("Silakan pilih bulan terlebih dahulu!");
    return;
  }

  // --- 1. FUNGSI BANTU OTOMATIS ---
  const getNilaiData = (d) => Number(d.Nilai || d.Jumlah || d.Nominal || d.Total || d.nilai || d.jumlah || 0);
  const getMetodeBayar = (d) => d.Metode || d.Metode_Bayar || d.Metode_Pembayaran || d.Kas || d.metode || '-';
  const formatRp = (num) => new Intl.NumberFormat('id-ID').format(num || 0);
  
  const formatTanggalBulan = (str) => {
    if (!str) return '';
    const match = str.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (match) {
      const y = parseInt(match[1]);
      const m = parseInt(match[2]) - 1;
      if (match[3]) {
        return new Date(y, m, parseInt(match[3])).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      } else {
        return new Date(y, m, 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });
      }
    }
    return str;
  };

  // --- 2. KALKULASI HEADER BULAN ---
  const tglObj = new Date(bln + "-01");
  const namaBulanTerpilih = tglObj.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  const tglSebelum = new Date(tglObj);
  tglSebelum.setMonth(tglObj.getMonth() - 1);
  const namaBulanSebelum = tglSebelum.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  // --- 3. FILTER & KALKULASI UANG MASUK & KELUAR ---
  const dataMasuk = DB.pemasukan.filter(d => d.Tanggal && d.Tanggal.startsWith(bln));
  const dataKeluar = DB.pengeluaran.filter(d => d.Tanggal && d.Tanggal.startsWith(bln));

  let sMasuk = DB.pemasukan.filter(d => d.Tanggal && d.Tanggal < bln).reduce((sum, d) => sum + getNilaiData(d), 0);
  let sKeluar = DB.pengeluaran.filter(d => d.Tanggal && d.Tanggal < bln).reduce((sum, d) => sum + getNilaiData(d), 0);
  let saldoAwal = sMasuk - sKeluar;

  let rekapMasuk = {};
  dataMasuk.forEach(d => { const k = d.Jenis || 'Lainnya'; rekapMasuk[k] = (rekapMasuk[k] || 0) + getNilaiData(d); });
  
  let rekapKeluar = {};
  dataKeluar.forEach(d => { const k = d.Jenis || 'Lainnya'; rekapKeluar[k] = (rekapKeluar[k] || 0) + getNilaiData(d); });

  let totMasuk = Object.values(rekapMasuk).reduce((a, b) => a + b, 0);
  let totKeluar = Object.values(rekapKeluar).reduce((a, b) => a + b, 0);
  let saldoAkhir = saldoAwal + totMasuk - totKeluar;

  // --- 4. ENGINE PELACAK TUNGGAKAN WARGA ---
  let totalTunggakan = 0;
  let dataTunggakan = [];
  const grupWarga = [...new Set((DB.pendaftaran || []).map(p => p.Nama_Warga))];

  grupWarga.forEach(nama => {
    const iuranWajibWarga = DB.pendaftaran.filter(p => 
      p.Nama_Warga === nama && p.Status_Keikutsertaan && p.Status_Keikutsertaan.trim().toLowerCase() === 'ikut'
    );
    if (iuranWajibWarga.length === 0) return;

    let akumulasiWarga = 0;
    let rincianWeb = [];

    iuranWajibWarga.forEach(iuran => {
      const nominalTarif = Number(iuran.Nominal || 0);
      const sifatIuran = iuran.Sifat ? iuran.Sifat.trim().toLowerCase() : "bulanan";

      if (sifatIuran === "sekali") {
        const cekPernahBayar = DB.pemasukan.find(p => p.Nama === nama && p.Jenis === iuran.Jenis_Iuran);
        if (!cekPernahBayar) {
          akumulasiWarga += nominalTarif;
          rincianWeb.push(`${iuran.Jenis_Iuran}`);
        }
      } else {
        const bulanMulaiTagihan = iuran.Mulai_Bulan ? iuran.Mulai_Bulan.trim() : bln.substring(0,4) + "-01";
        
        // Panggil fungsi hitung rentang Anda yang sudah ada di script
        let semuaBulanWajib = [];
        if (typeof hitungRentangBulan === "function") {
           semuaBulanWajib = hitungRentangBulan(bulanMulaiTagihan, bln);
        } else {
           // Fallback pencegahan error
           let dateStart = new Date(bulanMulaiTagihan + "-01");
           let dateEnd = new Date(bln + "-01");
           while (dateStart <= dateEnd) {
             semuaBulanWajib.push(`${dateStart.getFullYear()}-${String(dateStart.getMonth() + 1).padStart(2, '0')}`);
             dateStart.setMonth(dateStart.getMonth() + 1);
           }
        }

        semuaBulanWajib.forEach(b => {
          const cekBayar = DB.pemasukan.find(p => p.Nama === nama && p.Jenis === iuran.Jenis_Iuran && p.Bulan === b);
          if (!cekBayar) {
            akumulasiWarga += nominalTarif;
            let namaBulanPendek = new Date(b + "-01").toLocaleDateString('id-ID', {month: 'short', year: '2-digit'});
            rincianWeb.push(`${iuran.Jenis_Iuran} (${namaBulanPendek})`);
          }
        });
      }
    });

    if (akumulasiWarga > 0) {
      totalTunggakan += akumulasiWarga;
      dataTunggakan.push({ nama: nama, rincian: rincianWeb.join(', '), nominal: akumulasiWarga });
    }
  });

  // --- 5. BUILD HTML WAWASAN (BOX ATAS) ---
  let htmlMasuk = '';
  for (let k in rekapMasuk) htmlMasuk += `<div class="row-data"><span>${k}</span><span>Rp ${formatRp(rekapMasuk[k])}</span></div>`;
  if(!htmlMasuk) htmlMasuk = `<div class="row-data text-muted"><i>Tidak ada pemasukan</i></div>`;

  let htmlKeluar = '';
  for (let k in rekapKeluar) htmlKeluar += `<div class="row-data"><span>${k}</span><span>Rp ${formatRp(rekapKeluar[k])}</span></div>`;
  if(!htmlKeluar) htmlKeluar = `<div class="row-data text-muted"><i>Tidak ada pengeluaran</i></div>`;

  // --- 6. BUILD HTML LAMPIRAN TABEL ---
  let trKeluar = dataKeluar.length > 0 ? dataKeluar.map(d => {
    let ketKeluar = (d.Keterangan || '').replace(/\b\d{4}-\d{2}\b/g, m => formatTanggalBulan(m));
    return `
    <tr>
      <td class="center" style="width: 15%;">${formatTanggalBulan(d.Tanggal)}</td>
      <td style="width: 18%; font-weight: 500;">${d.Jenis || '-'}</td>
      <td style="width: 35%;">${ketKeluar || '-'}</td>
      <td class="center" style="width: 14%;">${getMetodeBayar(d)}</td>
      <td class="right text-danger" style="width: 18%; font-weight: 600;">Rp ${formatRp(getNilaiData(d))}</td>
    </tr>`
  }).join('') : `<tr><td colspan="5" class="center text-muted">Tidak ada data pengeluaran bulan ini</td></tr>`;
    
  let trMasuk = dataMasuk.length > 0 ? dataMasuk.map(d => {
    let bulanTeks = formatTanggalBulan(d.Bulan);
    let gabunganKeterangan = `${d.Jenis || ''} ${d.Nama || ''} ${bulanTeks || ''}`.trim().replace(/\s+/g, ' ');
    if (!gabunganKeterangan) gabunganKeterangan = d.Keterangan || '-';
    return `
      <tr>
        <td class="center" style="width: 15%;">${formatTanggalBulan(d.Tanggal)}</td>
        <td style="width: 18%; font-weight: 500;">${d.Jenis || '-'}</td>
        <td style="width: 35%;">${gabunganKeterangan}</td>
        <td class="center" style="width: 14%;">${getMetodeBayar(d)}</td>
        <td class="right text-success" style="width: 18%; font-weight: 600;">Rp ${formatRp(getNilaiData(d))}</td>
      </tr>`
  }).join('') : `<tr><td colspan="5" class="center text-muted">Tidak ada data pemasukan bulan ini</td></tr>`;

  let trTunggakan = dataTunggakan.length > 0 ? dataTunggakan.map((d, index) => `
    <tr>
      <td class="center" style="width: 8%;">${index + 1}</td>
      <td style="width: 25%; font-weight: 500;">${d.nama}</td>
      <td style="width: 49%;">${d.rincian}</td>
      <td class="right text-danger" style="width: 18%; font-weight: 600;">Rp ${formatRp(d.nominal)}</td>
    </tr>
  `).join('') : `<tr><td colspan="4" class="center text-success fw-bold" style="padding: 15px;">🎉 Luar biasa! Seluruh warga lunas, tidak ada tunggakan.</td></tr>`;

  // --- 7. RENDER JENDELA CETAK A4 ---
  const htmlDokumen = `
    <html>
    <head>
      <title>Laporan Keuangan - ${namaBulanTerpilih}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @media print { html, body { height: auto !important; overflow: visible !important; } tr { page-break-inside: avoid; } }
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1e293b; line-height: 1.5; -webkit-print-color-adjust: exact; }
        .header { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
        .logo { max-height: 55px; margin-bottom: 8px; }
        h1 { font-size: 18px; margin: 0; font-weight: 700; letter-spacing: 0.5px; color: #0f172a; }
        h3 { font-size: 12px; margin: 5px 0 0 0; font-weight: 400; color: #475569; }
        .summary-container { display: flex; gap: 20px; margin-bottom: 20px; }
        .box { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 15px; background: #f8fafc; }
        .box-title { font-weight: 700; font-size: 11px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 8px; text-transform: uppercase; }
        .row-data { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; color: #334155; }
        .row-data:last-child { border-bottom: none; }
        .total-row { display: flex; justify-content: space-between; font-weight: 700; padding-top: 8px; margin-top: 5px; border-top: 2px solid #cbd5e1; font-size: 11px; }
        .saldo-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 15px; margin-bottom: 30px; }
        .saldo-row { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; color: #334155; }
        .saldo-akhir { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #0f172a; border-top: 2px solid #64748b; padding-top: 8px; margin-top: 8px; }
        .lampiran-title { text-align: center; font-size: 13px; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; background: #0f172a; color: #ffffff; padding: 6px; border-radius: 4px; }
        .section-tabel { margin-bottom: 35px; page-break-inside: avoid; }
        .sub-tabel-title { font-size: 11px; font-weight: 700; margin-bottom: 8px; color: #1e293b; text-transform: uppercase; display: flex; align-items: center; gap: 5px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 8px; vertical-align: middle; }
        th { background: #f8fafc; font-weight: 600; text-align: center; color: #475569; }
        .center { text-align: center; }
        .right { text-align: right; }
        .text-success { color: #16a34a; }
        .text-danger { color: #dc2626; }
        .text-warning { color: #ea580c; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://lh3.googleusercontent.com/u/0/d/1mRLgMm0yQTd7tvGZMlljONAD75EiwATc" class="logo" alt="Logo Lorong 9">
        <h1>LAPORAN KEUANGAN LORONG 9</h1>
        <h3>Bulan: <b>${namaBulanTerpilih}</b></h3>
      </div>
      <div class="summary-container">
        <div class="box" style="border-top: 3px solid #16a34a;">
          <div class="box-title text-success">Pemasukan</div>
          ${htmlMasuk}
          <div class="total-row"><span>Total Pemasukan:</span><span class="text-success">Rp ${formatRp(totMasuk)}</span></div>
        </div>
        <div class="box" style="border-top: 3px solid #dc2626;">
          <div class="box-title text-danger">Pengeluaran</div>
          ${htmlKeluar}
          <div class="total-row"><span>Total Pengeluaran:</span><span class="text-danger">Rp ${formatRp(totKeluar)}</span></div>
        </div>
      </div>
      <div class="saldo-box">
        <div class="saldo-row"><span>Sisa Saldo Bulan ${namaBulanSebelum}</span><span>Rp ${formatRp(saldoAwal)}</span></div>
        <div class="saldo-row"><span>Pemasukan Bulan Ini</span><span class="text-success">+ Rp ${formatRp(totMasuk)}</span></div>
        <div class="saldo-row"><span>Pengeluaran Bulan Ini</span><span class="text-danger">- Rp ${formatRp(totKeluar)}</span></div>
        <div class="saldo-row text-warning" style="font-weight:600;margin-top:5px;"><span>⚠️ Total Tunggakan Warga Tertahan</span><span>Rp ${formatRp(totalTunggakan)}</span></div>
        <div class="saldo-akhir"><span>SALDO AKHIR (UANG FISIK KAS)</span><span>Rp ${formatRp(saldoAkhir)}</span></div>
      </div>
      <div class="lampiran-title">Lampiran Rincian Transaksi</div>
      <div class="section-tabel">
        <div class="sub-tabel-title" style="border-left:3px solid #dc2626;padding-left:6px;">🔴 Rincian Pengeluaran (Uang Keluar)</div>
        <table>
          <thead><tr><th>Tanggal</th><th>Jenis Kategori</th><th>Keterangan</th><th>Metode Bayar</th><th>Nilai (Rp)</th></tr></thead>
          <tbody>${trKeluar}</tbody>
        </table>
      </div>
      <div class="section-tabel">
        <div class="sub-tabel-title" style="border-left:3px solid #16a34a;padding-left:6px;">🟢 Rincian Pemasukan (Uang Masuk)</div>
        <table>
          <thead><tr><th>Tanggal</th><th>Jenis Kategori</th><th>Keterangan</th><th>Metode Bayar</th><th>Nilai (Rp)</th></tr></thead>
          <tbody>${trMasuk}</tbody>
        </table>
      </div>
      <div class="section-tabel">
        <div class="sub-tabel-title" style="border-left:3px solid #ea580c;padding-left:6px;color:#ea580c;">🟠 Rincian Tunggakan Warga (Belum Lunas)</div>
        <table>
          <thead><tr><th>No</th><th>Nama Warga</th><th>Rincian Bulan & Jenis Tunggakan</th><th>Total Tagihan (Rp)</th></tr></thead>
          <tbody>${trTunggakan}</tbody>
        </table>
      </div>
    </body>
    </html>
  `;

  if (typeof AndroidPrint !== 'undefined') {
    try {
      AndroidPrint.performPrintHtml(htmlDokumen);
    } catch (e) {
      alert("Gagal mencetak: " + e.message);
    }
  } else {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Popup diblokir browser. Izinkan popup untuk situs ini agar bisa mencetak.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(htmlDokumen);
    printWindow.document.close();
    setTimeout(function () {
      printWindow.print();
    }, 800);
  }
}

// --- FUNGSI 1: BUKA MODAL DAN ISI JENIS IURAN ---
function bukaModalShareWA() {
  // GERBANG KEAMANAN: Tolak jika bukan admin
  if (userRole !== 'admin') {
    alert("Maaf, fitur ini hanya untuk Admin.");
    return;
  }

  const listDiv = document.getElementById('list-pilihan-iuran');
  const jenisIuranList = [...new Set(DB.pendaftaran.map(p => p.Jenis_Iuran))];
  
  listDiv.innerHTML = '<p class="text-muted mb-3">Klik jenis iuran di bawah ini untuk copy format WA:</p>';
  
  jenisIuranList.forEach(jenis => {
    listDiv.innerHTML += `
      <button class="btn btn-outline-primary w-100 mb-2" onclick="prosesShareWA('${jenis}')">
        ${jenis}
      </button>
    `;
  });
  
  new bootstrap.Modal(document.getElementById('modalShareWA')).show();
}

function prosesShareWA(jenisIuran) {
  const bln = document.getElementById('fKeuBulan').value;
  if (!bln) { alert("Pilih bulan dulu di filter!"); return; }
  
  // --- FORMAT TANGGAL & WAKTU ---
  const now = new Date();
  
  // Format Tanggal: "Selasa, 19 Mei 2026"
  const tgl = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Format Jam: "11:19:21"
  const jam = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const updateString = `${tgl} ${jam}`;
  const tglBulan = new Date(bln + "-01").toLocaleDateString('id-ID', {month: 'long', year: 'numeric'});
  
  // Hitung Total Diterima
  const dataPemasukan = DB.pemasukan.filter(p => p.Jenis === jenisIuran && p.Bulan === bln);
  const totalDiterima = dataPemasukan.reduce((sum, p) => sum + Number(p.Jumlah || 0), 0);
  
  // Format Pesan
  let pesan = `*Lorong 9*\n`;
  pesan += `*${jenisIuran}* Bulan ${tglBulan}\n`;
  pesan += `Total Sementara : Rp ${totalDiterima.toLocaleString('id-ID')}\n`;
  pesan += `Update : ${updateString}\n`; // Menggunakan format gabungan
  pesan += `-------------------\n`;
  
  // --- DATA RETRIEVAL ---
  const wargaIkut = DB.pendaftaran.filter(p => p.Jenis_Iuran === jenisIuran && p.Status_Keikutsertaan && p.Status_Keikutsertaan.trim().toLowerCase() === 'ikut');
  
  if (wargaIkut.length === 0) {
    alert("Data warga tidak ditemukan untuk jenis iuran ini. Cek kembali data pendaftaran!");
    return;
  }
  
  wargaIkut.forEach((p, index) => {
    const namaWarga = p.Nama_Warga || p.Nama || "Tanpa Nama";
    const infoWarga = DB.warga.find(w => w.Nama === namaWarga);
    const alamat = infoWarga ? infoWarga.Alamat : '-';
    const statusTinggal = infoWarga ? infoWarga.Status : '-';
    
    const sudahBayar = DB.pemasukan.find(pms => pms.Nama === namaWarga && pms.Jenis === jenisIuran && pms.Bulan === bln);
    const statusBayar = sudahBayar ? "Lunas" : "Belum Lunas";
    
    pesan += `${index + 1}. *${namaWarga}* - ${alamat} - ${statusTinggal} - ${statusBayar}\n`;
  });
  
  // Copy ke Clipboard
  navigator.clipboard.writeText(pesan).then(() => {
    alert("Data berhasil disalin! Silakan paste di WA.");
    const modalEl = document.getElementById('modalShareWA');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  });
}


</script>