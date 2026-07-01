Step by step Implementation of the DocQuery-AI
1.Created Node.js + Express server.

Added routes: /upload for documents, /ask for questions.

Integrated google gemini embeddings API.

Connected to MongoDB Atlas using the key and url
2. Initialize Frontend
Created React app with create-react-app.

Built file upload component.

Built chat interface with responsive design.

Connected frontend to backend APIs.
3. Document Processing
Extracted text from PDF using pdf-parse.

Split text into chunks (~500–1000 characters).

Generated embeddings for each chunk.

Stored {chunk, embedding, metadata} in MongoDB here metadata involves chunk id.
4.Question Answering
User enters a question in chat.

Backend generates embedding for query.

Performs vector similarity search in MongoDB.

Retrieves top-k chunks.

Sends chunks + question to gemini model.

Returns grounded answer to frontend.
