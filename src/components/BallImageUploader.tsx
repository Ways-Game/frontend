import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Image } from "lucide-react";

interface BallImageUploaderProps {
  onImagesChange: (images: string[]) => void;
}

export const BallImageUploader = ({ onImagesChange }: BallImageUploaderProps) => {
  const [images, setImages] = useState<string[]>([]);
  
  const loadAssetImages = () => {
    // setImages(assetImages);
    // onImagesChange(assetImages);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageUrl = e.target?.result as string;
          setImages(prev => {
            const newImages = [...prev, imageUrl];
            onImagesChange(newImages);
            return newImages;
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      onImagesChange(newImages);
      return newImages;
    });
  };

  return (
    <Card className="card-gaming p-4">
      <h3 className="font-bold text-lg mb-4">Изображения для шаров</h3>
      
      <div className="mb-4 flex gap-2">
        <Button onClick={loadAssetImages} className="btn-gaming">
          <Image className="w-4 h-4 mr-2" />
          Использовать тестовые фото
        </Button>
        <label className="btn-gaming cursor-pointer inline-flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Загрузить свои
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((image, index) => (
            <div key={index} className="relative group">
              <img
                src={image}
                alt={`Ball ${index + 1}`}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-sm text-gray-400 mt-2">
          Загружено {images.length} изображений. Они будут случайно назначены шарам.
        </p>
      )}
    </Card>
  );
};