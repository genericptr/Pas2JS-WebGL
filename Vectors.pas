{$mode objfpc}

unit vectors;
interface
uses
	BrowserConsole, JS;

type
	TScalar = single;
	TScalarArray = array of TScalar;
	
type
	TVec2 = class (TJSArray)
		private
			procedure SetX (newValue: TScalar);
			procedure SetY (newValue: TScalar);

			function GetX: TScalar;
			function GetY: TScalar;
		public
			constructor Create;

			property x: TScalar read GetX write SetX;
			property y: TScalar read GetY write SetY;
	end;

implementation

procedure TVec2.SetX (newValue: TScalar);
begin
	//SetElements(0, newValue);
	Elements[0] := newValue;
end;

procedure TVec2.SetY (newValue: TScalar);
begin
	Elements[1] := newValue;
end;

function TVec2.GetX: TScalar;
begin
	result := TScalar(Elements[0]); // Illegal type conversion: "set" to "Double"
end;

function TVec2.GetY: TScalar;
begin
	result := TScalar(Elements[1]);
end;

constructor TVec2.Create;
begin
end;

end.