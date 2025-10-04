
// import lande from 'lande';
import DetectLanguage from 'detectlanguage'
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.LANG_API_KEY;
var detectlanguage = new DetectLanguage(apiKey || "");

export const langDetector = async (lang: string) => {
    try {
        const language = await detectlanguage.detect(lang);
        return language[0].language
    } catch (error) {
        // REMOVED CLD and implemented detectlanguage only
        return "en"
    }
}

export const groupActionCheck = (action: string, participant: string) => {
    const participantCall = participant.split("@")[0];
    if (action === "add") {
        return `hello @${participantCall}`
    }
    else if (action === "remove") {
        return `@${participantCall} has been ${action}d`
    }
    else if (action === "promote") {
        return `@${participantCall} has been ${action}d`
    }
    else if (action === "demote") {
        return `@${participantCall} has been ${action}d`
    }
    return ""
}

export const randomTimer = () => {
    const time = Math.ceil(Math.random() * 3)
    return time * 1000
}