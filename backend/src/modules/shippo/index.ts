import { ModuleProviderExports } from '@medusajs/framework/types'
import ShippoProviderService from "./service";

const services = [ShippoProviderService]

const providerExport: ModuleProviderExports = {
    services,
}

export default providerExport
