"use client";

import Image from "next/image";

import { Swiper, SwiperSlide } from "swiper/react";

import { Autoplay, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";

const banners = [
  "/images/banner/banner1.png",
  "/images/banner/banner2.png",
  "/images/banner/banner3.png",
];

export default function BannerSlider() {
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
        {banners.map((banner) => (
          <SwiperSlide key={banner}>
            <div className="relative h-48 md:h-64">
              <Image
                src={banner}
                alt="Banner"
                fill
                priority
                className="object-cover"
              />
            </div>
          </SwiperSlide>
        ))}
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