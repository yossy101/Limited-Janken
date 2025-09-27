import { useEffect, useState } from "react";

interface RoomQRCodeProps {
  url: string;
}

export const RoomQRCode = ({ url }: RoomQRCodeProps) => {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    if (!url) {
      setDataUrl("");
      return () => {
        active = false;
      };
    }

    const generate = async () => {
      try {
        const QRCode = await import("qrcode");
        const result = await QRCode.toDataURL(url, { width: 256, margin: 1 });
        if (active) {
          setDataUrl(result);
        }
      } catch (error) {
        console.error("Failed to generate QR", error);
      }
    };

    void generate();

    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className="rounded-2xl bg-white/90 p-4 text-center text-slate-900">
      <p className="mb-2 text-sm font-semibold">プレイヤー入室QR</p>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="room qr" className="mx-auto h-48 w-48" />
      ) : (
        <span className="text-xs text-slate-500">生成中...</span>
      )}
    </div>
  );
};
