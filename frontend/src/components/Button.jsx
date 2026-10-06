// A real <button> with consistent styling and a built-in disabled look. Using a
// shared component means every submit button can be disabled while a request is
// in flight (which prevents double submits that would hit 409 conflicts).
export default function Button({ variant = "primary", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium " +
    "focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-300",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-300",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
