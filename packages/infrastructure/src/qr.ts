import QRCode from 'qrcode';

export async function qrPngBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: 'png', margin: 2, width: 512 });
}
