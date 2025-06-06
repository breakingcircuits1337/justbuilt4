import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import MistralClient from '@mistralai/mistralai';
import Groq from 'groq-sdk';

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const mistral = new MistralClient(process.env.MISTRAL_API_KEY || '');
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export const handler: Handler = async (event) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { prompt, model, type } = JSON.parse(event.body || '{}');

    console.log('Received request:', { prompt, model, type });
    console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Loaded' : 'Not loaded');
    console.log('MISTRAL_API_KEY:', process.env.MISTRAL_API_KEY ? 'Loaded' : 'Not loaded');
    console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Loaded' : 'Not loaded');


    if (!prompt || !model || !type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' }),
      };
    }

    let result;
    const systemPrompt = type === 'plan'
      ? `You are an expert software developer. Create a detailed, step-by-step development plan. Format as JSON array with \'description\' and \'prompt\' fields.`
      : type === 'structure'
      ? `Generate a file structure as JSON array with \'name\', \'type\', and optional \'children\' fields.`
      : `Generate clean, well-documented code only, no explanations.`;

    switch (model) {
      case 'gemini': {
        const genModel = gemini.getGenerativeModel({ model: 'gemini-pro' });
        const response = await genModel.generateContent(systemPrompt + "\\n\\n" + prompt);
        result = response.response.text();
        console.log('Gemini response:', result);
        break;
      }
      case 'mistral': {
        const response = await mistral.chat({
          model: 'mistral-large-latest',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ]
        });
        result = response.choices[0].message.content;
        console.log('Mistral response:', result);
        break;
      }
      case 'groq': {
        const response = await groq.chat.completions.create({
          model: 'mixtral-8x7b-32768',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ]
        });
        result = response.choices[0].message.content;
        console.log('Groq response:', result);
        break;
      }
      default:
        throw new Error('Invalid model specified');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ result }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
