# WCAGger

Web accessibility compliance checker built with Nuxt 4, utilizing Axe and Pa11y for comprehensive WCAG auditing.

## 🚀 Features

- **Dual Engine Analysis**: Combines Axe and Pa11y for thorough accessibility testing
- **WCAG Compliance**: Supports multiple WCAG standards and levels
- **Multi-language Support**: Available in English and Polish
- **PDF Report Generation**: Export detailed accessibility reports
- **Modern UI**: Clean, responsive interface built with Vue 3 and Tailwind CSS

## 🛠️ Tech Stack

- **Frontend**: Nuxt 4, Vue 3, TypeScript
- **Accessibility Engines**: Axe Core, Pa11y
- **Browser Automation**: Puppeteer
- **Internationalization**: Nuxt i18n
- **Styling**: Tailwind CSS
- **Containerization**: Docker

## 📋 Prerequisites

- Node.js 20+
- Docker and Docker Compose

## 🚀 Quick Start

### Using Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd wcagger
   ```

2. Start the application:
   ```bash
   docker-compose up --build
   ```

3. Open your browser and navigate to `http://localhost:1270`

## 📖 Usage

1. Enter the URL of the website you want to test
2. Select your preferred accessibility tools (Axe, Pa11y, or both)
3. Choose the WCAG compliance level
4. Click "Start Accessibility Check" to start the analysis
5. Review the results and export a PDF report if needed

## 🏗️ Project Structure

```
wcagger/
├── config/
│   └── Dockerfile             # Docker configuration
├── nuxt/
│   ├── app/
│   │   ├── pages/index.vue    # Main application
│   │   └── components/        # Vue components
│   ├── server/
│   │   ├── api/               # API endpoints
│   │   └── services/          # Business logic services
│   │   └── utils/             # Utility functions
│   ├── shared/
│   │   └── types/             # TypeScript type definitions
│   └── i18n/                  # Internationalization files
└── docker-compose.yml         # Docker Compose configuration
```

## 🔧 API Endpoints

- `POST /api/check-accessibility` - Run accessibility analysis
- `POST /api/generate-pdf` - Generate PDF report
- `GET /api/health` - Health check

## 🌐 Supported Languages

- English (en)
- Polish (pl)

## 📊 Accessibility Standards

- WCAG 2.0
- WCAG 2.1
- WCAG 2.2

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Axe Core](https://github.com/dequelabs/axe-core) - Accessibility testing engine
- [Pa11y](https://github.com/pa11y/pa11y) - Accessibility testing tool
- [Nuxt](https://nuxt.com/) - Vue.js framework
- [Puppeteer](https://github.com/puppeteer/puppeteer) - Headless Chrome Node.js API
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
