import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const MODEL = 'text-embedding-3-small' // cheap+good

export async function embed(text: string): Promise<number[]> {
  const input = text.length > 8000 ? text.slice(0, 8000) : text
  const { data } = await client.embeddings.create({ model: MODEL, input })
  return data[0].embedding as unknown as number[]
}
