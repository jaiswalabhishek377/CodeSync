import axios from 'axios';

// All API communication for auth goes through this file
export const authenticateUser = async (baseUrl, type, data) => {
  const endpoint = type === "Login" ? "/api/auth/login" : "/api/auth/register";
  
  try {
    const response = await axios.post(baseUrl + endpoint, data);
    return response.data; // Return the exact data payload
  } catch (error) {
    // Standardize the error response so the UI always gets a clean message
    const errorMessage = error.response?.data?.message || "An error occurred";
    return { success: false, message: errorMessage };
  }
};