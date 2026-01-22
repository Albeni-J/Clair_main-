import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const textGen = async (req, res) => {
  try {
    // нужно получить текст из тела запроса
    const { text } = req.body;
    //если текста нет вернуть ошибку
    if (!text) {
      return res.status(400).json({ error: "Поле 'text' обязательно" });
    }
    //Если есть текст выполнить перевод через Gemini API крч хуй знает как оно там работает
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `генерирую тект и просто отвечай на вопросы: ${text}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    res.json({ response });
  } catch (error) {
    console.error("Ошибка при обращении к Gemini API:", error);
    res.status(500).json({ error: "Ошибка при запросе к Gemini API" });
  }
};
