unit GLTypes;
interface
uses
	WebGL, JS;

// TODO: when advanced record syntax is added move these to records

type
	TVec2 = array of GLfloat;
	TRGBAb = array of GLubyte;
	TRGBAf = array of GLfloat;

function TVec2_Sizeof: integer;
function TRGBAb_Sizeof: integer;
function TRGBAf_Sizeof: integer;

function V2(x, y: GLfloat): TVec2;
function RGBAb(r, g, b, a: GLubyte): TRGBAb;
function RGBAf(r, g, b, a: GLfloat): TRGBAf;

implementation

function V2(x, y: GLfloat): TVec2;
begin
	result[0] := x;
	result[1] := y;
end;

function RGBAb(r, g, b, a: GLubyte): TRGBAb;
begin
	result[0] := r;
	result[1] := g;
	result[2] := b;
	result[3] := a;
end;

function RGBAf(r, g, b, a: GLfloat): TRGBAf;
begin
	result[0] := r;
	result[1] := g;
	result[2] := b;
	result[3] := a;
end;

function TVec2_Sizeof: integer;
begin
	result := (4 * 2);
end;

function TRGBAb_Sizeof: integer;
begin
	result := (1 * 4);
end;

function TRGBAf_Sizeof: integer;
begin
	result := (4 * 4);
end;

end.