import { Route, Routes } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import ForgotPassword from "./routes/ForgotPassword";
import Login from "./routes/Login";
import MainMenu from "./routes/MainMenu";
import RequireAuth from "./routes/RequireAuth";
import ResetPassword from "./routes/ResetPassword";
import VerifyEmail from "./routes/VerifyEmail";
import FarmMap from "./world/FarmMap";

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<MainMenu />} />
			<Route path="/login" element={<Login />} />
			<Route path="/verify" element={<VerifyEmail />} />
			<Route path="/forgot" element={<ForgotPassword />} />
			<Route path="/reset" element={<ResetPassword />} />
			<Route
				path="/world"
				element={
					<RequireAuth>
						<FarmMap />
					</RequireAuth>
				}
			/>
			<Route
				path="/farms/:owner"
				element={
					<RequireAuth>
						<FarmMap />
					</RequireAuth>
				}
			/>
			<Route
				path="/dashboard"
				element={
					<RequireAuth>
						<Dashboard />
					</RequireAuth>
				}
			/>
		</Routes>
	);
}
