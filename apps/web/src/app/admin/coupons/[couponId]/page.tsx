import { CouponDetail } from '../../../../components/coupon-detail';
export default async function CouponDetailPage({
  params,
}: {
  params: Promise<{ couponId: string }>;
}) {
  const { couponId } = await params;
  return <CouponDetail id={couponId} />;
}
