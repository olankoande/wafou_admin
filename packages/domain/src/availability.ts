/** Dated declarations; bookings and recurring rules are separate concerns. */
export interface AvailabilitySlot {id:string;starts_at:string;ends_at:string;timezone:string}
export interface ProviderAgenda {provider_id:string;agenda_version:number;slots:AvailabilitySlot[]}
