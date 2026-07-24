import { v2 as cloudinary } from "cloudinary";
import { envVeriables } from "../config/envConfig";

// TODO:
// Replace Cloudinary implementation with AWS S3 uploader in future.

cloudinary.config({
  cloud_name: envVeriables.CLOUDINARY_CLOUD_NAME,
  api_key: envVeriables.CLOUDINARY_API_KEY,
  api_secret: envVeriables.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
  filePath: string,
  folder: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, { folder }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result!.secure_url);
      }
    });
  });
};
