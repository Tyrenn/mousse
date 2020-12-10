
//@ts-ignore
import { extname } from "https://deno.land/std@0.80.0/path/mod.ts";

export function getContentType(filepath: string): string | undefined {
  return MIME.DB[extname(filepath)];
}

export namespace MIME {
  export const ApplicationGZip = "application/gzip",
    ApplicationJSON = "application/json",
    ApplicationJSONCharsetUTF8 = ApplicationJSON + "; charset=UTF-8",
    ApplicationJavaScript = "application/javascript",
    ApplicationJavaScriptCharsetUTF8 = ApplicationJavaScript + "; charset=UTF-8",
    ApplicationXML = "application/xml",
    ApplicationXMLCharsetUTF8 = ApplicationXML + "; charset=UTF-8",
    TextMarkdown = "text/markdown",
    TextMarkdownCharsetUTF8 = TextMarkdown + "; charset=UTF-8",
    TextXML = "text/xml",
    TextXMLCharsetUTF8 = TextXML + "; charset=UTF-8",
    ApplicationForm = "application/x-www-form-urlencoded",
    ApplicationProtobuf = "application/protobuf",
    ApplicationMsgpack = "application/msgpack",
    TextHTML = "text/html",
    TextHTMLCharsetUTF8 = TextHTML + "; charset=UTF-8",
    TextPlain = "text/plain",
    TextPlainCharsetUTF8 = TextPlain + "; charset=UTF-8",
    MultipartForm = "multipart/form-data",
    OctetStream = "application/octet-stream",
    ImageSVG = "image/svg+xml";

  export const DB: Record<string, string | undefined> = {
    ".md": TextMarkdownCharsetUTF8,
    ".html": TextHTMLCharsetUTF8,
    ".htm": TextHTMLCharsetUTF8,
    ".json": ApplicationJSON,
    ".map": ApplicationJSON,
    ".txt": TextPlainCharsetUTF8,
    ".ts": ApplicationJavaScriptCharsetUTF8,
    ".tsx": ApplicationJavaScriptCharsetUTF8,
    ".js": ApplicationJavaScriptCharsetUTF8,
    ".jsx": ApplicationJavaScriptCharsetUTF8,
    ".gz": ApplicationGZip,
    ".svg": ImageSVG,
  };
}