# 📋 ProjeBoard — Kanban Yönetim Sistemi

Sürükle-bırak destekli, tam özellikli şirket içi proje yönetim aracı.

## 🏗️ Mimari

```
kanban-app/
├── docker-compose.yml          # Tüm servisleri ayağa kaldırır
├── frontend/                   # React + Vite (Nginx'te serve edilir)
│   ├── src/
│   │   ├── App.jsx             # Ana uygulama & Kanban board
│   │   └── api.js              # Backend API istemcisi
│   ├── nginx.conf              # Nginx + API proxy ayarları
│   ├── docker-entrypoint.sh    # Container başlangıç scripti
│   └── Dockerfile              # Multi-stage: build → nginx
├── backend/                    # Node.js + Express REST API
│   ├── src/
│   │   ├── index.js            # Tüm API route'ları
│   │   ├── auth.js             # JWT tabanlı kimlik doğrulama
│   │   ├── validation.js       # Zod ile giriş doğrulama
│   │   ├── tasks.js            # Görev CRUD işlemleri
│   │   ├── employees.js        # Çalışan CRUD işlemleri
│   │   └── kpi.js              # KPI hesaplama fonksiyonları
│   ├── db/
│   │   └── init.sql            # PostgreSQL şema + seed data
│   ├── Dockerfile              # Node.js runtime
│   └── package.json            # Bağımlılıklar ve scriptler
└── README.md
```

**Servisler:**

| Servis   | Port | Açıklama                     |
|----------|------|------------------------------|
| Frontend | 3000 | React SPA (Nginx)            |
| Backend  | 4000 | Node.js / Express REST API   |
| Database | 5432 | PostgreSQL 16                |

---

## 🚀 Kurulum & Çalıştırma

### Gereksinimler
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS / Linux)
- Git

### Tek Komutla Başlat

```bash
# Repo'yu klonla (ya da zip'i aç)
git clone <repo-url>
cd kanban-app

# Tüm servisleri build et ve başlat
docker compose up --build
```

İlk çalıştırmada image'lar build edileceği için 2-3 dakika sürebilir.

### Uygulamaya Eriş

Tarayıcında aç: **http://localhost:3000**

---

## 🛑 Durdurma & Yönetim

```bash
# Uygulamayı durdur
docker compose down

# Uygulamayı durdur + veritabanını SİL (dikkatli!)
docker compose down -v

# Log'ları izle
docker compose logs -f

# Sadece backend log'ları
docker compose logs -f backend

# Servislerin durumunu gör
docker compose ps

# Tek servisi yeniden başlat
docker compose restart backend
```

---

## 📡 API Endpointleri

### Tasks (Görevler)
| Method | Endpoint               | Açıklama                    |
|--------|------------------------|-----------------------------|
| GET    | `/api/tasks`           | Tüm görevleri listele       |
| GET    | `/api/tasks?assignee_id=2` | Kişiye göre filtrele   |
| GET    | `/api/tasks?status=process` | Duruma göre filtrele |
| GET    | `/api/tasks/:id`       | Tek görev                   |
| POST   | `/api/tasks`           | Yeni görev oluştur          |
| PUT    | `/api/tasks/:id`       | Görevi güncelle             |
| PATCH  | `/api/tasks/:id/status`| Sadece status güncelle      |
| DELETE | `/api/tasks/:id`       | Görevi sil                  |

### Employees (Çalışanlar)
| Method | Endpoint               | Açıklama                    |
|--------|------------------------|-----------------------------|
| GET    | `/api/employees`       | Tüm çalışanları listele     |
| POST   | `/api/employees`       | Yeni çalışan ekle           |
| DELETE | `/api/employees/:id`   | Çalışanı sil                |

### KPI (Performans Göstergeleri)
| Method | Endpoint               | Açıklama                    |
|--------|------------------------|-----------------------------|
| GET    | `/api/kpi`             | Tüm KPI verilerini getir    |

### POST /api/tasks — Body Örneği
```json
{
  "title": "Yeni özellik geliştir",
  "description": "Kullanıcı profil sayfası",
  "topic": "Frontend",
  "assignee_ids": [2, 3],
  "deadline": "2026-04-01",
  "status": "new",
  "position": 1
}
```

### PUT /api/tasks/:id — Body Örneği (kısmi güncelleme)
```json
{
  "status": "process"
}
```

---

## ✨ Özellikler

- **Kanban board** — NEW → IN PROCESS → BLOCKED → DONE kolonları
- **Sürükle & bırak** — Kartları kolonlar arasında taşı
- **Çalışan filtresi** — Kişiye göre görevleri filtrele
- **Görev yönetimi** — Ekle, düzenle, sil
- **Çalışan yönetimi** — ⚙ panelinden ekle / sil
- **Vade uyarısı** — Geçmiş tarihler kırmızı ⚠ ile gösterilir
- **Canlı istatistikler** — Header'da kolondaki görev sayıları
- **Kalıcı veri** — PostgreSQL veritabanı (Docker volume)

---

## 🔧 Geliştirme Ortamı (Docker olmadan)

```bash
# PostgreSQL kurulu olmalı, .env dosyası oluştur:
# DATABASE_URL=postgresql://kanban:kanban_secret@localhost:5432/kanbandb

# Backend
cd backend
npm install
npm run dev   # http://localhost:4000

# Frontend (ayrı terminal)
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## 🏢 Şirket Sunucusuna Deploy

```bash
# Sunucuya kopyala
scp -r kanban-app/ user@server:/opt/kanban-app

# Sunucuda çalıştır
cd /opt/kanban-app
docker compose up -d --build
```

> Güvenlik için production'da `POSTGRES_PASSWORD` ve backend ortam değişkenlerini
> `.env` dosyasına taşıyın ve bu dosyayı `.gitignore`'a ekleyin.
