import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

export default function AdminMenuCard({
    href,
    icon: Icon,
    title,
    description,
}: {
    href: string;
    icon: any;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md"
        >
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition group-hover:bg-rose-50 group-hover:text-rose-600">
                    <Icon size={20} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-gray-900">
                            {title}
                        </h3>

                        <FiArrowRight
                            size={18}
                            className="shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-rose-600"
                        />
                    </div>

                    <p className="mt-1 text-sm leading-6 text-gray-500">
                        {description}
                    </p>
                </div>
            </div>
        </Link>
    );
}