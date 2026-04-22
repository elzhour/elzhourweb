import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { uploadImage, cldThumb } from "@/lib/cloudinary";
import { toast } from "sonner";
import { User } from "lucide-react";

interface AvatarUploadProps {
  photoURL?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
  editable?: boolean;
  onUpload?: (url: string) => Promise<void> | void;
}

export function AvatarUpload({
  photoURL,
  name,
  size = 56,
  ring = false,
  editable = false,
  onUpload,
}: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  const ringClass = ring ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background" : "";
  const displayUrl = localUrl || photoURL;
  const initial = name?.charAt(0) || "؟";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setLocalUrl(previewUrl);
    setUploading(true);

    try {
      const url = await uploadImage(file);
      setLocalUrl(url);
      await onUpload?.(url);
      toast.success("تم تغيير الصورة بنجاح");
    } catch (err: any) {
      toast.error("فشل رفع الصورة", { description: err.message });
      setLocalUrl(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const AvatarImg = () => {
    if (displayUrl) {
      return (
        <img
          src={cldThumb(displayUrl, size * 2)}
          alt={name || "avatar"}
          className={`rounded-full object-cover shrink-0 ${ringClass}`}
          style={{ width: size, height: size }}
        />
      );
    }
    return (
      <div
        className={`rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 ${ringClass}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {name ? initial : <User style={{ width: size * 0.5, height: size * 0.5 }} />}
      </div>
    );
  };

  if (!editable) {
    return <AvatarImg />;
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <AvatarImg />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity disabled:cursor-wait"
        aria-label="تغيير الصورة"
      >
        {uploading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Camera className="text-white" style={{ width: size * 0.35, height: size * 0.35 }} />
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
