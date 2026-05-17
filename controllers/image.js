// controllers/image.js

const FormData = require("form-data");
const fs = require("fs");
const axios = require("axios");

const DETECTION_API_URL =
  process.env.DETECTION_API_URL || "http://host.docker.internal:5000/detect";

const uploadImage = async (filePath) => {
  const formData = new FormData();

  formData.append("image", fs.createReadStream(filePath));

  try {
    const response = await axios.post(DETECTION_API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return response.data;
  } catch (error) {
    console.error(
      "Error sending image to detection API:",
      error.response ? error.response.data : error.message,
    );

    throw error;
  }
};

module.exports = {
  uploadImage,
};
