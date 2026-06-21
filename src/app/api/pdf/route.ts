import { NextRequest, NextResponse } from "next/server";
import type { ChatMessage } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface PdfBody {
  messages: ChatMessage[];
  title?: string;
  provider?: string;
  model?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: PdfBody = await req.json();
    const { messages, title = "Kutadgubilgi Code Sohbet Raporu" } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Mesajlar gerekli" }, { status: 400 });
    }

    // Basit PDF formatı (raw PDF syntax)
    // Gerçek PDF için reportlab/jsPDF gerekir, ama biz minimal PDF üretelim
    const pdfContent = generateSimplePdf(messages, title);

    return new NextResponse(pdfContent, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="kutadgubilgi-sohbet-${Date.now()}.pdf"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateSimplePdf(messages: ChatMessage[], title: string): Buffer {
  // Minimal PDF - text content
  const lines: string[] = [];
  lines.push(title);
  lines.push("Generated: " + new Date().toLocaleString("tr-TR"));
  lines.push("Messages: " + messages.length);
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("");

  messages.forEach((msg, idx) => {
    const role = msg.role === "user" ? "👤 SİZ" : msg.role === "assistant" ? "🤖 AI" : "SYSTEM";
    const time = new Date(msg.timestamp).toLocaleString("tr-TR");
    lines.push(`${idx + 1}. [${role}] ${time}`);
    if (msg.provider) lines.push(`   Provider: ${msg.provider} | Model: ${msg.model ?? "unknown"}`);
    if (msg.tokensIn || msg.tokensOut) {
      lines.push(`   Tokens: ${msg.tokensIn ?? 0} in / ${msg.tokensOut ?? 0} out`);
    }
    lines.push("");
    lines.push(msg.content);
    lines.push("");
    lines.push("-".repeat(60));
    lines.push("");
  });

  // Toplam maliyet
  const totalCost = messages.reduce((s, m) => s + (m.cost ?? 0), 0);
  if (totalCost > 0) {
    lines.push("");
    lines.push("Toplam Maliyet: $" + totalCost.toFixed(4));
  }

  const text = lines.join("\n");

  // Minimal PDF structure
  // Bu çok basit bir PDF - gerçek rendering için jsPDF/reportlab önerilir
  const escapedText = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .split("\n");

  const contentLines: string[] = [];
  let y = 750;
  for (const line of escapedText) {
    if (y < 50) break; // sayfa dolu
    contentLines.push(`BT /F1 10 Tf`);
    contentLines.push(`1 0 0 1 50 ${y} Tm`);
    contentLines.push(`(${line.slice(0, 100)}) Tj`);
    y -= 14;
  }

  const contentStream = contentLines.join("\n");

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${contentStream.length} >>
stream
${contentStream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000${(300 + contentStream.length).toString().padStart(7, "0")} 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + contentStream.length}
%%EOF`;

  return Buffer.from(pdf, "latin1");
}
