'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';

interface Avatar {
  id: string;
  name: string;
  imagePath: string;
  isActive: boolean;
  createdAt: string;
}

export default function AvatarPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('Мой аватар');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  function load() {
    fetch('/api/avatar')
      .then((r) => r.json())
      .then((data) => setAvatars(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', files[0]);
      fd.append('name', name || 'My Avatar');
      const res = await fetch('/api/avatar', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAvatars((prev) => [data, ...prev]);
      setMsg('Аватар загружен!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  }, [name]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: uploading,
  });

  async function setActive(id: string) {
    const res = await fetch('/api/avatar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: true }),
    });
    if (res.ok) {
      setAvatars((prev) => prev.map((a) => ({ ...a, isActive: a.id === id })));
      setMsg('Активный аватар обновлён!');
      setTimeout(() => setMsg(''), 2000);
    }
  }

  async function deleteAvatar(id: string) {
    if (!confirm('Удалить этот аватар?')) return;
    const res = await fetch('/api/avatar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setAvatars((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Управление аватаром</h1>
        <p className="text-gray-400 text-sm mt-1">
          Аватар будет автоматически добавлен на все сгенерированные изображения карусели
        </p>
      </div>

      {msg && <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 text-green-400 text-sm">{msg}</div>}
      {error && <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-400 text-sm">⚠️ {error}</div>}

      {/* Upload */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Загрузить новый аватар</h2>

        <div className="mb-3">
          <label className="label">Название аватара</label>
          <input
            className="input"
            placeholder="например, Фото профиля"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-purple-500 bg-purple-900/20'
              : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="text-4xl mb-3">{uploading ? '⏳' : '📤'}</div>
          {uploading ? (
            <p className="text-gray-400">Загрузка и обработка...</p>
          ) : isDragActive ? (
            <p className="text-purple-400">Отпустите фото здесь</p>
          ) : (
            <>
              <p className="text-gray-300 font-medium">Перетащите фото сюда</p>
              <p className="text-gray-500 text-sm mt-1">или нажмите для выбора — JPG, PNG, WebP</p>
              <p className="text-gray-600 text-xs mt-2">Будет обрезано до квадрата и изменён размер до 400×400px</p>
            </>
          )}
        </div>
      </div>

      {/* Avatars List */}
      {!loading && (
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-4">Ваши аватары</h2>
          {avatars.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Аватары ещё не загружены</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {avatars.map((avatar) => (
                <div
                  key={avatar.id}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                    avatar.isActive ? 'border-purple-500' : 'border-gray-700'
                  }`}
                >
                  <div className="aspect-square relative bg-gray-800">
                    <Image
                      src={avatar.imagePath}
                      alt={avatar.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {avatar.isActive && (
                    <div className="absolute top-2 left-2 bg-purple-600 rounded-full px-2 py-0.5 text-xs text-white font-medium">
                      Активный
                    </div>
                  )}

                  <div className="p-2">
                    <p className="text-sm text-gray-300 font-medium truncate">{avatar.name}</p>
                    <div className="flex gap-1 mt-2">
                      {!avatar.isActive && (
                        <button
                          onClick={() => setActive(avatar.id)}
                          className="flex-1 text-xs bg-purple-700/30 text-purple-400 border border-purple-700/50 rounded-lg py-1 hover:bg-purple-700/50 transition-colors"
                        >
                          Сделать активным
                        </button>
                      )}
                      <button
                        onClick={() => deleteAvatar(avatar.id)}
                        className="flex-1 text-xs bg-red-900/20 text-red-400 border border-red-700/30 rounded-lg py-1 hover:bg-red-900/40 transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="card bg-gray-900/50">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Как это работает</h3>
        <ul className="space-y-1 text-sm text-gray-500">
          <li>• Активный аватар автоматически накладывается на сгенерированные изображения карусели</li>
          <li>• Он отображается в левом нижнем углу с белой рамкой</li>
          <li>• Можно иметь несколько аватаров и переключаться между ними</li>
          <li>• Лучший результат с чётким портретом или логотипом</li>
        </ul>
      </div>
    </div>
  );
}
