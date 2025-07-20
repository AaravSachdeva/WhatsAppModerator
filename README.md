# 📱 WhatsApp Moderator Bot

A Node.js-based WhatsApp bot built with [Baileys](https://github.com/adiwajshing/Baileys) that monitors messages in a group and detects the language being used. Useful for moderating multilingual groups or enforcing a single-language rule.

---

## 🚀 Features

- ✅ Connects to WhatsApp using Baileys
- 🌍 Detects the language of each message using [node-cld](https://github.com/dachev/node-cld) and [DetectLanguage API](https://detectlanguage.com/)
- 🔔 Can be configured to moderate or react to messages in specific languages
- 💬 Supports both short and long phrases
- ⚙️ Easily configurable via `.env`
- 🧠 Written in TypeScript for better developer experience

---

## 📦 Requirements

- Node.js `>=20.x`
- A WhatsApp account (for QR login)
- [DetectLanguage API Key](https://detectlanguage.com/)

---

## 🛠 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/whatsapp-moderator-bot.git
cd whatsapp-moderator-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create and Configure .env
Create a `.env` file in the root of your project and fill in your values:

| Key           | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `GROUP_ID`    | The WhatsApp Group JID (e.g. `1234567890-123456789@g.us`) to monitor |
| `LANG_API_KEY`| Your API key from [DetectLanguage.com](https://detectlanguage.com) |


```bash
cp .env.example .env
```


### 4. Running in Development

```bash
npm run dev
```


