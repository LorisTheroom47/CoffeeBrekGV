export const deliveryPointOptions = [
  {
    value: "A",
    title: "A",
    description: "Piano terra, davanti agli ascensori",
    label: "A — Piano terra, davanti agli ascensori",
  },
  {
    value: "B",
    title: "B",
    description: "Piano terra, davanti agli ascensori",
    label: "B — Piano terra, davanti agli ascensori",
  },
  {
    value: "C",
    title: "C",
    description: "Piano terra, davanti agli ascensori",
    label: "C — Piano terra, davanti agli ascensori",
  },
  {
    value: "PRONTO_SOCCORSO",
    title: "Pronto Soccorso",
    description: null,
    label: "Pronto Soccorso",
  },
  {
    value: "PALAZZINA_BLU",
    title: "Palazzina Blu",
    description: null,
    label: "Palazzina Blu",
  },
] as const;

export type DeliveryPoint = (typeof deliveryPointOptions)[number]["value"];

export const deliveryTimeSlots = [
  "12:00",
  "12:15",
  "12:30",
  "12:45",
  "13:00",
  "13:15",
  "13:30",
  "13:45",
  "14:00",
] as const;

export function isDeliveryPoint(value: unknown): value is DeliveryPoint {
  return deliveryPointOptions.some((option) => option.value === value);
}

export function getDeliveryPointLabel(value: unknown): string | null {
  return (
    deliveryPointOptions.find((option) => option.value === value)?.label ?? null
  );
}

export function isDeliveryTimeSlot(value: unknown): value is string {
  return deliveryTimeSlots.some((slot) => slot === value);
}

export function isNormalizedDeliveryTimeSlot(value: unknown): value is string {
  return (
    typeof value === "string" &&
    deliveryTimeSlots.some((slot) => `${slot}:00` === value)
  );
}
