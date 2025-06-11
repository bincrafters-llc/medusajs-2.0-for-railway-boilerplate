import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import {
    FulfillmentOption,
    CreateShippingOptionDTO,
    CalculateShippingOptionPriceDTO,
    CalculatedShippingOptionPrice,
    ValidateFulfillmentDataContext,
    FulfillmentItemDTO,
    FulfillmentDTO,
    FulfillmentOrderDTO,
    CreateFulfillmentResult
} from "@medusajs/framework/types";
import {Shippo, ShipmentCreateRequest, Rate, Shipment} from "shippo";
import {CartLineItemDTOExtended, OptionDataExtended} from "modules/shippo/types";
import shippo from "modules/shippo/index";

export type ShippoOptions = {
    apiKey: string;
}

class ShippoProviderService extends AbstractFulfillmentProviderService {
    static identifier = "shippo"
    private shippo: Shippo;

    constructor({}, options: ShippoOptions) {
        super()

        this.shippo = new Shippo({ apiKeyHeader: options.apiKey });
    }

    override async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
        console.log('*** Fetching fulfillment options from Shippo ***');

        const carriers = await this.shippo.carrierAccounts.list({
            results: 200
        });

        return carriers.results.map(carrier => ({
            id: carrier.objectId,
            name: carrier.carrierName + ' ' + carrier.metadata,
            description: '',
            provider_id: carrier.objectId,
            data: {
                carrier_account_id: carrier.accountId,
                service_level_token: null, // TODO: Where to get this from
            }
        }));
    }

    override async canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
        console.log('*** Can calculate from shippo ***')
        return true;
    }

    async calculatePrice(
        optionData: CalculateShippingOptionPriceDTO["optionData"],
        data: CalculateShippingOptionPriceDTO["data"],
        context: CalculateShippingOptionPriceDTO["context"]): Promise<CalculatedShippingOptionPrice>
    {
        console.log('*** Calculating pricing from shippo ***');
        console.log(JSON.stringify(optionData, null, 4));
        console.log(JSON.stringify(data, null, 4));
        console.log(JSON.stringify(context, null, 4));

        const extendedOptionData = optionData as unknown as OptionDataExtended;
        let shipment: Shipment;

        const { shipment_id } = data as {
            shipment_id?: string
        } || {};


        if (!shipment_id) {
            const from = context.from_location;
            const to = context.shipping_address;

            if (!from || !to) {
                throw new Error("From and To addresses are required for calculating shipping rates.");
            }

            const req: ShipmentCreateRequest = {
                carrierAccounts: [extendedOptionData.provider_id],
                addressFrom: {
                    name: from.name,
                    company: from.address.company,
                    street1: from.address.address_1,
                    street2: from.address.address_2,
                    city: from.address.city,
                    state: from.address.province,
                    zip: from.address.postal_code,
                    country: from.address.country_code,
                    phone: from.address.phone,
                },
                addressTo: {
                    company: to.company,
                    street1: to.address_1,
                    street2: to.address_2,
                    city: to.city,
                    state: to.province,
                    zip: to.postal_code,
                    country: to.country_code,
                    phone: to.phone,
                },
                parcels: context.items.map((i: CartLineItemDTOExtended) => ({
                    length: i.variant?.length?.toString() || "5",
                    width: i.variant?.width?.toString() || "5",
                    height: i.variant?.height?.toString() || "5",
                    distanceUnit: "cm",
                    weight: i.variant?.weight?.toString() || "5", // (i.variant?.weight || 1) * i.quantity,
                    massUnit: "g"
                }))

            };

            console.log('*** Shipment Request ***')
            console.log(JSON.stringify(req, null, 4));

            shipment = await this.shippo.shipments.create(req);
        } else {
            shipment = await this.shippo.shipments.get(shipment_id);
        }

        const rate = shipment.rates[0];

        return {
            calculated_amount: +rate?.amount || 0,
            is_calculated_price_tax_inclusive: false
        }
    }

    override async validateFulfillmentData(optionData: Record<string, unknown>, data: Record<string, unknown>, context: ValidateFulfillmentDataContext): Promise<any> {
        console.log('*** Validating fulfillment data for Shippo provider ***');
        console.log(JSON.stringify(optionData, null, 4));
        console.log(JSON.stringify(data, null, 4));
        console.log(JSON.stringify(context, null, 4));

        const carrier_id = optionData.provider_id as string;
        const carrier_service_code = optionData.carrier_service_code as string;

        if (!carrier_id || typeof carrier_id !== "string") {
            throw new Error("Invalid or missing carrier_id in fulfillment option data.");
        }

        const carriers = await this.shippo.carrierAccounts.list({
            results: 200
        });
        const isValidCarrier = carriers.results.some(c => c.accountId === carrier_id);

        if (!isValidCarrier) {
            throw new Error("Provided carrier_id is not recognized.");
        }

        // if (!carrier_service_code || typeof carrier_service_code !== "string") {
        //     throw new Error("Invalid or missing carrier_service_code in fulfillment option data.");
        // }

        console.log('validation ended');

        return {
            carrier_id,
            carrier_service_code,
        };
    }

    async createFulfillment(
        data: Record<string, unknown>,
        items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
        order: Partial<FulfillmentOrderDTO> | undefined, fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
    ): Promise<CreateFulfillmentResult> {
        if (!order?.shipping_address || !data?.carrier_id || !data?.carrier_service_code) {
            throw new Error("Missing shipping address or carrier information");
        }



        //
        // const from = {
        //     name: "Your Store",
        //     street1: "123 Warehouse St",
        //     city: "Miami",
        //     state: "FL",
        //     zip: "33101",
        //     country: "US",
        //     phone: "555-555-5555"
        // };
        //
        // const to = {
        //     name: `${order.shipping_address.first_name} ${order.shipping_address.last_name}`,
        //     street1: order.shipping_address.address_1,
        //     street2: order.shipping_address.address_2,
        //     city: order.shipping_address.city,
        //     state: order.shipping_address.province,
        //     zip: order.shipping_address.postal_code,
        //     country: order.shipping_address.country_code,
        //     phone: order.shipping_address.phone
        // };
        //
        // const parcel = {
        //     length: "10",
        //     width: "6",
        //     height: "4",
        //     distance_unit: "cm",
        //     weight: "500",
        //     mass_unit: "g"
        // };
        //
        // // 1. Create shipment
        // const shipment = await this.shippo.shipments.create({
        //     addressFrom: from,
        //     addressTo: to,
        //     parcels: [parcel],
        //     carrierAccounts: [data.carrier_id],
        //     servicelevelToken: data.carrier_service_code
        // });
        //
        // // 2. Find correct rate
        // const rate = shipment.rates.find(
        //     (r) =>
        //         r.carrier_account === data.carrier_id &&
        //         r.servicelevel.token === data.carrier_service_code
        // );
        //
        // if (!rate) {
        //     throw new Error("Matching rate not found in Shippo response");
        // }
        //
        // // 3. Create transaction (i.e., buy label)
        // const transaction = await this.shippo.transactions.create({
        //     shipment: shipment.object_id,
        //     rate: rate.object_id,
        //     label_file_type: "PDF",
        //     async: false
        // });
        //
        // if (transaction.status !== "SUCCESS") {
        //     throw new Error(`Shippo transaction failed: ${transaction.messages?.[0]?.text || "Unknown error"}`);
        // }
        //
        // return {
        //     tracking_number: transaction.tracking_number,
        //     tracking_url: transaction.tracking_url_provider,
        //     label_url: transaction.label_url,
        //     external_id: transaction.object_id,
        //     data: {
        //         shippo_transaction_id: transaction.object_id,
        //         carrier: transaction.provider,
        //         service: transaction.servicelevel?.name
        //     }
        // };

        return {
            labels: [""]
        } as any
    }

    getIdentifier(): any {
        return 'shippo';
    }

}

export default ShippoProviderService;

