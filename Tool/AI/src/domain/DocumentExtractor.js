/**
 * DocumentExtractor
 *
 * Utility to extract text from various document formats.
 * Supports: PDF, DOCX, Markdown, TXT
 *
 * No persistence side-effects.
 */

const fs = require("fs");

/**
 * Extract text from a file based on its extension.
 * @param {{ path: string, buffer?: Buffer }} input
 * @returns {{ text: string, fileName: string, mimeType: string }}
 */
async function extractText(input = {}) {
  const filePath = String(input.path || "");
  const buffer = input.buffer || (filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath) : null);
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : "pasted-content";

  if (!buffer) {
    throw new Error("Document buffer or path is required.");
  }

  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase() : "";

  if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
    return {
      text: String(buffer).replace(/\r\n/g, "\n").trim(),
      fileName,
      mimeType: ext === ".md" || ext === ".markdown" ? "text/markdown" : "text/plain",
    };
  }

  if (ext === ".pdf") {
    return extractPdf(buffer, fileName);
  }

  if (ext === ".docx") {
    return extractDocx(buffer, fileName);
  }

  // Unknown but text-like
  const decoded = String(buffer);
  if (/^[\x00-\x7F\s]*$/.test(decoded)) {
    return { text: decoded.replace(/\r\n/g, "\n").trim(), fileName, mimeType: "text/plain" };
  }

  throw new Error(`Unsupported document type: ${ext || fileName}`);
}

/**
 * Extract text from PDF.
 * Requires pdf-parse dependency. If not installed, throws with instructions.
 */
async function extractPdf(buffer, fileName) {
  let pdfParse;
  try {
    pdfParse = require("pdf-parse");
  } catch {
    throw new Error(
      "PDF extraction requires the 'pdf-parse' package. Install it with: npm install pdf-parse"
    );
  }

  const data = await pdfParse(buffer);
  const text = (data.text || "").replace(/\r\n/g, "\n").trim();
  return { text: text || "", fileName, mimeType: "application/pdf" };
}

/**
 * Extract text from DOCX using best-effort XML parsing.
 */
async function extractDocx(buffer, fileName) {
  let zip;
  try {
    zip = require("jszip");
  } catch {
    throw new Error(
      "DOCX extraction requires the 'jszip' package. Install it with: npm install jszip"
    );
  }

  if (typeof zip === "function") {
    try {
      const contents = zip.sync(buffer);
      const docXml = contents.file("word/document.xml");
      if (!docXml) {
        return { text: "", fileName, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
      }
      let xml = "";
      if (typeof docXml.async === "function") {
        xml = await docXml.async("string");
      } else if (docXml.data) {
        xml = String(docXml.data);
      }
      const text = extractTextFromDocxXml(xml);
      return { text, fileName, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    } catch {
      // fall through
    }
  }

  return { text: "", fileName, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
}

/**
 * Minimal DOCX XML to text extraction.
 */
function extractTextFromDocxXml(xml) {
  // Remove namespace prefixes and tags, decode common XML entities
  const cleaned = xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

module.exports = {
  extractText,
  extractPdf,
  extractDocx,
  extractTextFromDocxXml,
};