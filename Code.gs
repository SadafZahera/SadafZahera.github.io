/* 
  GOOGLE APPS SCRIPT BACKEND
  Filename: Code.gs
*/

const SITE_DATA_FILE_ID = "1yAt6mEE22zhjyvlvYgdz7ln1Mfjkc_6-";
const THEME_FILE_ID = "1iX18lIGoB0nX0g07LE7RNEh8wzI6spnI";
const CONFIG_FILE_ID = "11HQMdm7-VISZ0kDmz79Rx4d-aYeNKOmb";
const UPLOAD_FOLDER_ID = "1MQF_jNM-0TjmwXdCYYFd3u21vFAZideK";
const EXPECTED_TOKEN = "ILoveS7f8a";

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const params = e.parameter;
    const action = params.action;
    const token = params.token;

    if (token !== EXPECTED_TOKEN) {
      return responseJSON({ error: "Unauthorized", success: false });
    }

    if (action === "getData") {
      return getJsonContent(SITE_DATA_FILE_ID);
    } else if (action === "saveData") {
      const data = JSON.parse(e.postData.contents);
      return saveJsonContent(SITE_DATA_FILE_ID, data);
    } else if (action === "getTheme") {
      return getJsonContent(THEME_FILE_ID);
    } else if (action === "saveTheme") {
      const data = JSON.parse(e.postData.contents);
      return saveJsonContent(THEME_FILE_ID, data);
    } else if (action === "login") {
      const creds = JSON.parse(e.postData.contents);
      return handleLogin(creds);
    } else if (action === "uploadFile") {
      const data = JSON.parse(e.postData.contents);
      return uploadFile(data);
    } else {
      return responseJSON({ error: "Invalid Action", success: false });
    }

  } catch (err) {
    return responseJSON({ error: err.toString(), success: false });
  } finally {
    lock.releaseLock();
  }
}

function getJsonContent(fileId) {
  const file = DriveApp.getFileById(fileId);
  const content = file.getBlob().getDataAsString();
  return responseJSON(JSON.parse(content));
}

function saveJsonContent(fileId, jsonData) {
  const file = DriveApp.getFileById(fileId);
  file.setContent(JSON.stringify(jsonData, null, 2));
  return responseJSON({ success: true });
}

function handleLogin(creds) {
  const file = DriveApp.getFileById(CONFIG_FILE_ID);
  const config = JSON.parse(file.getBlob().getDataAsString());
  
  if (creds.username === config.admin.username && creds.password === config.admin.password) {
    return responseJSON({ success: true });
  } else {
    return responseJSON({ success: false, error: "Invalid credentials" });
  }
}

function uploadFile(payload) {
  const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const blob = Utilities.newBlob(Utilities.base64Decode(payload.data), payload.mimeType, payload.filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // Return direct-ish link format.
  // Note: For images to work reliably as src, use: https://lh3.googleusercontent.com/d/FILE_ID
  const directLink = "https://lh3.googleusercontent.com/d/" + file.getId();
  
  return responseJSON({ success: true, url: directLink });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}