import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const QRCode = dynamic(() => import("qrcode.react"), { ssr: false });

interface QRDisplayProps {
  roomCode: string;
}

export function QRDisplay({ roomCode }: QRDisplayProps) {
  return (
    <motion.div
      className="bg-[#111b33]/80 border border-[#25315c] rounded-2xl p-4 flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <p className="text-sm uppercase text-gray-400 tracking-widest">join via qr</p>
      <div className="mt-3 bg-white p-4 rounded-xl">
        <QRCode value={roomCode} size={160} includeMargin={false} />
      </div>
      <p className="mt-3 text-lg font-semibold text-neon">Room: {roomCode}</p>
    </motion.div>
  );
}
