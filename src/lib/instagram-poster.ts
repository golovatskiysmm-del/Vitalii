import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const BASE_URL = 'https://graph.facebook.com/v18.0';

interface PostSlide {
  imagePath: string; // local path like /generated/xxx.jpg
  imageUrl?: string; // public URL if available
}

interface PostCarouselParams {
  accountId: string;
  accessToken: string;
  slides: PostSlide[];
  caption: string;
  appUrl: string; // e.g., https://your-app.vercel.app
}

async function uploadImageContainer(
  accountId: string,
  accessToken: string,
  imageUrl: string,
  isCarouselItem: boolean
): Promise<string> {
  const params: Record<string, string> = {
    image_url: imageUrl,
    access_token: accessToken,
  };
  if (isCarouselItem) params.is_carousel_item = 'true';

  const res = await axios.post(`${BASE_URL}/${accountId}/media`, null, { params });
  return res.data.id as string;
}

async function publishCarousel(
  accountId: string,
  accessToken: string,
  containerIds: string[],
  caption: string
): Promise<string> {
  // Create carousel container
  const carouselRes = await axios.post(`${BASE_URL}/${accountId}/media`, null, {
    params: {
      media_type: 'CAROUSEL',
      children: containerIds.join(','),
      caption,
      access_token: accessToken,
    },
  });
  const carouselContainerId = carouselRes.data.id as string;

  // Wait for container to be ready
  await waitForContainerReady(carouselContainerId, accessToken);

  // Publish
  const publishRes = await axios.post(`${BASE_URL}/${accountId}/media_publish`, null, {
    params: {
      creation_id: carouselContainerId,
      access_token: accessToken,
    },
  });

  return publishRes.data.id as string;
}

async function waitForContainerReady(containerId: string, accessToken: string, maxRetries = 10): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await axios.get(`${BASE_URL}/${containerId}`, {
      params: { fields: 'status_code,status', access_token: accessToken },
    });
    const status = res.data.status_code;
    if (status === 'FINISHED') return;
    if (status === 'ERROR') throw new Error(`Media container error: ${res.data.status}`);
  }
  throw new Error('Timeout waiting for media container to be ready');
}

export async function postCarouselToInstagram(params: PostCarouselParams): Promise<string> {
  const { accountId, accessToken, slides, caption, appUrl } = params;

  if (slides.length < 2) {
    throw new Error('Instagram carousels require at least 2 slides');
  }

  if (slides.length > 10) {
    throw new Error('Instagram carousels support maximum 10 slides');
  }

  // Build public URLs for each slide image
  const containerIds: string[] = [];
  for (const slide of slides) {
    const publicUrl = slide.imageUrl || `${appUrl}${slide.imagePath}`;
    const containerId = await uploadImageContainer(accountId, accessToken, publicUrl, true);
    containerIds.push(containerId);
  }

  const mediaId = await publishCarousel(accountId, accessToken, containerIds, caption);
  return mediaId;
}

export async function postSingleImageToInstagram(
  accountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const containerRes = await axios.post(`${BASE_URL}/${accountId}/media`, null, {
    params: { image_url: imageUrl, caption, access_token: accessToken },
  });
  const containerId = containerRes.data.id as string;

  await waitForContainerReady(containerId, accessToken);

  const publishRes = await axios.post(`${BASE_URL}/${accountId}/media_publish`, null, {
    params: { creation_id: containerId, access_token: accessToken },
  });

  return publishRes.data.id as string;
}

export async function validateInstagramToken(accountId: string, accessToken: string): Promise<{ username: string; name: string }> {
  const res = await axios.get(`${BASE_URL}/${accountId}`, {
    params: { fields: 'username,name', access_token: accessToken },
  });
  return { username: res.data.username, name: res.data.name };
}
