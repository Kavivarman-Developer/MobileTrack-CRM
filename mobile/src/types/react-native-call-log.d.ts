declare module "react-native-call-log" {
  export type CallLogEntry = {
    id?: string;
    phoneNumber?: string;
    name?: string;
    timestamp?: string | number;
    dateTime?: string;
    duration?: string | number;
    type?: string | number;
  };

  const CallLogs: {
    load(limit: number, filter?: Record<string, unknown>): Promise<CallLogEntry[]>;
  };

  export default CallLogs;
}
