import Cleaning from '@mui/icons-material/CleaningServicesOutlined';
import Home from '@mui/icons-material/HomeOutlined';
import Sofa from '@mui/icons-material/WeekendOutlined';
import Bed from '@mui/icons-material/BedOutlined';
import Kitchen from '@mui/icons-material/CountertopsOutlined';
import Bathroom from '@mui/icons-material/BathtubOutlined';
import Toilet from '@mui/icons-material/WcOutlined';
import Office from '@mui/icons-material/DeskOutlined';
import Stairs from '@mui/icons-material/StairsOutlined';
import Laundry from '@mui/icons-material/LocalLaundryServiceOutlined';
import Oven from '@mui/icons-material/MicrowaveOutlined';
import Fridge from '@mui/icons-material/KitchenOutlined';
import Window from '@mui/icons-material/WindowOutlined';
import Dishes from '@mui/icons-material/LocalDiningOutlined';
import Package from '@mui/icons-material/Inventory2Outlined';
import { serviceIconKey, type ServiceIconKey } from '@wafou/domain';

const icons: Record<ServiceIconKey, typeof Cleaning> = { cleaning:Cleaning,home:Home,sofa:Sofa,bed:Bed,kitchen:Kitchen,bathroom:Bathroom,toilet:Toilet,office:Office,stairs:Stairs,laundry:Laundry,oven:Oven,fridge:Fridge,window:Window,dishes:Dishes,package:Package };
/** Decorative: always accompany this icon with a translated service name. Never interpret stored markup. */
export function ServiceIcon({ value }: { value: unknown }) {
  const Icon = icons[serviceIconKey(value)];
  return <Icon aria-hidden="true" focusable="false" sx={{ color:'primary.main',fontSize:32 }} />;
}
