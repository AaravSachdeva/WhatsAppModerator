
// import lande from 'lande';
import cld from 'cld'
import DetectLanguage from 'detectlanguage'
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.LANG_API_KEY;
var detectlanguage = new DetectLanguage(apiKey || "");

export const langDetector = async (lang: string) => {
    try {
        const language = await cld.detect(lang);
        return language.languages[0].code
    } catch (error) {
        const language = await detectlanguage.detect(lang);
        return language[0].language
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
    const time = Math.ceil(Math.random() * 10)
    return time * 1000
}