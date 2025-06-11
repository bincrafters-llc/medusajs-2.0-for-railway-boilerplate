import { CartLineItemDTO, CalculateShippingOptionPriceDTO } from "@medusajs/framework/types";

export interface CartLineItemDTOExtended extends CartLineItemDTO {
    variant: {
        id: string;
        weight: number;
        length: number;
        height: number;
        width: number;
        material: string;
        product_id: string;
    }
}

export interface OptionDataExtended extends CalculateShippingOptionPriceDTO {
    optionData: {
        id: string;
        data: {
            carrier_account_id: string;
            service_level_token: string;
        },
        name: string;
        description: string;
        provider_id: string;
    }
}
