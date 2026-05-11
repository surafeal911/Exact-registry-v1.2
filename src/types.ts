export interface LoadDetails {
  vehicleType: string;
  vehicleSpecs: string;
  ratePerMile: string;
  wentActive: string;
  totalPrice: string;
  loadSize: string;
  distance: string;
  loadType: string;
  originState: string;
  originCity: string;
  destState: string;
  destCity: string;
  dispatcherBooked: string;
  marketer: string;
  mcNumber: string;
  dotNumber: string;
}

export interface Carrier {
  id: string;
  dispatcherName: string;
  marketerName: string;
  organization: string;
  transferDate: string;
  timeOfTransfer: string;
  timeOfFirstContact: string;
  status: 'active' | 'inactive' | 'conversational';
  explanation: string;
  screenshot: string | null;
  screenshots?: string[];
  documentUrl?: string;
  editCount: number;
  createdAt: number;
  updatedAt?: number;
  loadDetails?: LoadDetails;
}

export type Tab = 'carriers' | 'loaddetails';

