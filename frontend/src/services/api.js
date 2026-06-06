/**
 * API Service
 *
 * Centralized API client for all backend Lambda function calls.
 * Uses Cognito ID token for authorization.
 */

const API_BASE_URL =
  "https://9v88c2cbyb.execute-api.us-east-1.amazonaws.com/prod"; // TODO: fill in after Member A deploys API Gateway

import { getAuthToken } from "./auth";

async function apiRequest(path, method = "GET", body = null) {
  const token = await getAuthToken();

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const errBody = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    const err = new Error(errBody.error || `API error: ${response.status}`);
    err.status = response.status;
    err.existingFile = errBody.existing_file || null;
    throw err;
  }

  return response.json();
}

// --- Upload ---

export async function getUploadUrl(fileName, fileType, userId, checksum) {
  return apiRequest("/upload", "POST", {
    file_name: fileName,
    file_type: fileType,
    user_id: userId,
    checksum
  });
}

export async function uploadFileToS3(presignedUrl, file) {
  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type
    }
  });

  if (!response.ok) {
    throw new Error("Failed to upload file to S3");
  }

  return true;
}

// --- Query ---

export async function queryByTags(tags) {
  return apiRequest("/query/tags", "POST", tags);
}

export async function queryBySpecies(speciesList) {
  return apiRequest("/query/species", "POST", { species: speciesList });
}

export async function queryByThumbnail(thumbnailUrl) {
  return apiRequest(`/query/thumbnail?url=${encodeURIComponent(thumbnailUrl)}`);
}

export async function queryByFile(formData) {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}/query/file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Query failed");
  }

  return response.json();
}

// --- Tags ---
// urls: string (single) or string[] (bulk)
// operation: 1 = add, 0 = remove

export async function addTags(urls, tags) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  return apiRequest("/tags", "POST", { urls: urlList, tags, operation: 1 });
}

export async function removeTags(urls, tags) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  return apiRequest("/tags", "POST", { urls: urlList, tags, operation: 0 });
}

// --- Files ---
// urls: string (single) or string[] (bulk)

export async function deleteFile(urls) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  return apiRequest("/files", "DELETE", { urls: urlList });
}

// --- Subscriptions (served by GCP Cloud Run) ---

const GCP_BASE_URL = "https://aws-cognito-authenticator-524389055136.us-central1.run.app";

async function gcpRequest(path, method = "GET", body = null) {
  const token = await getAuthToken();
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${GCP_BASE_URL}${path}`, options);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `GCP error: ${response.status}`);
  }
  return response.json();
}

export async function subscribe(userId, email, tagName) {
  return gcpRequest("/subscribe", "POST", { user_id: userId, email, tag_name: tagName });
}

export async function unsubscribe(userId, tagName) {
  return gcpRequest("/subscribe", "DELETE", { user_id: userId, tag_name: tagName });
}

export async function getSubscriptions(userId) {
  return gcpRequest(`/subscribe?user_id=${encodeURIComponent(userId)}`);
}
