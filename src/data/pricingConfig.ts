// src/data/pricingConfig.ts

export interface PricingDetails {
    fee: number;
    label: string;
    description: string;
}

export const PRICING_CONFIG: Record<string, PricingDetails> = {
    "startup": {
        fee: 2999,
        label: "Service Fee",
        description: "DPIIT Recognition & Benefits"
    },
    "dsc": {
        fee: 1350,
        label: "Service Fee",
        description: "Service fee included"
    },
    "company-registration": {
        fee: 1999,
        label: "Service Fee",
        description: "Includes DSC + DIN + SPICe+"
    },
    "adt-1": {
        fee: 699,
        label: "Service Fee",
        description: "MCA Service Fees"
    },
    "inc-20a": {
        fee: 699,
        label: "Service Fee",
        description: "MCA Service Fees"
    },
    "inc-22a": {
        fee: 699,
        label: "Service Fee",
        description: "All Inclusive Compliance"
    },
    "mgt7": {
        fee: 699,
        label: "Service Fee",
        description: "MCA Service Fees"
    },
    "aoc4": {
        fee: 699,
        label: "Service Fee",
        description: "Service fees included"
    },
    "dir-3-kyc": { fee: 699, label: "Service Fee", description: "DIR-3 KYC Maintenance" },
    "fssai": { fee: 100, label: "Service Fee", description: "FSSAI Basic License" },
    "trademark": { fee: 4500, label: "Service Fee", description: "Trademark Application (Individual)" },
    "pan": { fee: 107, label: "Service Fee", description: "Permanent Account Number" },
    "gst": {
        fee: 0,
        label: "Service Fee",
        description: "Completely Free"
    },
    "msme": {
        fee: 0,
        label: "Service Fee",
        description: "Completely Free"
    },
    "roc-package": {
        fee: 1499,
        label: "Service Fee",
        description: "MGT-7A + AOC-4 + ADT-1 + INC-20A"
    },
    "roc-package-standard": {
        fee: 999,
        label: "Service Fee",
        description: "Basic ROC Bundle"
    },
    "roc-package-premium": {
        fee: 1499,
        label: "Service Fee",
        description: "ROC + GST + MSME Bundle"
    },
    "trade-license": {
        fee: 0,
        label: "Service Fee",
        description: "Zero Service Fee License"
    }
};

export const GST_RATE = 0.18;

export const calculateGST = (price: number): number => {
    return Math.round(price * GST_RATE);
};

export const calculateTotalWithGST = (price: number): number => {
    return price + calculateGST(price);
};

export const getServicePrice = (id: string): number => {
    return PRICING_CONFIG[id]?.fee ?? 0;
};

export const getPriceLabel = (id: string): string => {
    return PRICING_CONFIG[id]?.label ?? "Service Fee";
};