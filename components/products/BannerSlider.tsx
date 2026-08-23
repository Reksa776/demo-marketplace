"use client";

import Link from "next/link";
import Image from "next/image";

import { Swiper, SwiperSlide } from "swiper/react";

import { Autoplay, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

type BannerItem = {
  id: number;
  imageUrl: string;
  title: string;
  link: string | null;
};

const fallbackBanners: BannerItem[] = [
  { id: 0, imageUrl: "/images/banner/banner1.png", title: "Banner", link: null },
  { id: 1, imageUrl: "/images/banner/banner2.png", title: "Banner", link: null },
  { id: 2, imageUrl: "/images/banner/banner3.png", title: "Banner", link: null },
];

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function BannerImage({ src, alt }: { src: string; alt: string }) {
  if (isExternalUrl(src)) {
    return (
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      className="object-cover"
    />
  );
}

export default function BannerSlider({ banners }: { banners?: BannerItem[] }) {
  const items = banners && banners.length > 0 ? banners : fallbackBanners;

  return (
    <div className="mx-auto mt-6 max-w-7xl px-5">
      <Swiper
        modules={[Autoplay, Pagination]}
        autoplay={{
          delay: 3000,
        }}
        pagination={{
          clickable: true,
        }}
        loop
        className="banner-swiper overflow-hidden rounded-2xl"
      >
        {items.map((banner) => {
          const slide = (
            <div className="relative h-48 md:h-64">
              <BannerImage src={banner.imageUrl} alt={banner.title} />
            </div>
          );

          return (
            <SwiperSlide key={banner.id}>
              {banner.link ? (
                <Link
                  href={banner.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {slide}
                </Link>
              ) : (
                slide
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>

      <style jsx global>{`
        .banner-swiper .swiper-pagination-bullet {
          background: #fff;
          opacity: 0.5;
          width: 5px;
          height: 5px;
        }
        .banner-swiper .swiper-pagination-bullet-active {
          opacity: 1;
          width: 14px;
          border-radius: 9999px;
          background: #fff;
        }
      `}</style>
    </div>
  );
}
