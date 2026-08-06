export async function getAIRecommendation(req, res, userPrompt, products){
    const api_key = process.env.GEMINI_API_KEY;
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${api_key}`;
    console.log(process.env.GEMINI_API_KEY);

    try{
        // Generate AI prompt using user query and SQL-filtered products
        // Prompt sent to Gemini for AI-based product filtering
        const geminiPrompt = `
        You are an AI shopping assistant.

        You will receive:
        1. A user's shopping request.
        2. A list of available products from the database.

        Your task is to:
        - Return ONLY the products that best match the user's request.
        - Do NOT create, modify, or invent any product.
        - Use only the products provided in the list.
        - Consider the product's name, description, category, price, brand, specifications, and other available details.
        - If multiple products match, rank them from best to least relevant.
        - If no products match, return an empty JSON array [].

        User Request:
        "${userPrompt}"

        Available Products:
        ${JSON.stringify(products, null, 2)}

        IMPORTANT:
        - Return ONLY valid JSON.
        - Do NOT include markdown (such as \`\`\`json).
        - Do NOT include explanations or extra text.
        - The response must be a JSON array that can be parsed directly using JSON.parse().

        Example Output:
        [
        {
            "product_id": 1,
            "name": "Gaming Laptop",
            "price": 74999
        },
        {
            "product_id": 5,
            "name": "Mechanical Keyboard",
            "price": 2999
        }
        ]
        `;

        // Send request to Gemini API
        const response = await fetch(URL, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                contents: [{parts: [{text: geminiPrompt}]}],
            }),
        });

        //check gemini response
        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.status}`);
        }

        // Parse Gemini API response
        const data = await response.json();

        console.log(JSON.stringify(data, null, 2));

        // Extract AI-generated text
        const aiResponseText = 
            data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        // Remove Markdown code block markers
        const cleanedText = aiResponseText
            .replace(/```json|```/g, "")
            .trim();

        if(!cleanedText){
            throw new Error("AI response is empty or invalid.");
        }

        let parsedProducts;
        try{
            // Convert JSON string into JavaScript object
            parsedProducts = JSON.parse(cleanedText);
        }catch(error){
            // return res.status(500).json({success: false, message: "Failed to parse AI response"});
            console.error("Gemini Error:", error);

            return res.status(500).json({
                success: false,
                message: error.message,
            });

        }
        return {success: true, products: parsedProducts};
    }catch(error){
        throw new Error("Internal server error.");
    }
}