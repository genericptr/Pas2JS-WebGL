program Pas2JS_WebGL_Terrain;
uses
	Terrain, Noise, Types, Mat4, GLUtils, GLTypes, 
	SysUtils,
	BrowserConsole, Web, WebGL, WebGL2, JS, Math;

var
	gl: TJSWebGLRenderingContext;
	shader: TShader;
  projTransform: TMat4;
  viewTransform: TMat4;
  modelTransform: TMat4;

 var
  debugConsole: TJSElement;
  canvasAnimationHandler: integer = 0;

var
	maps: TJSArray;
	camera: TVec3;
	lightPosition: TVec3;
  terrainNoise: TNoise;
	terrainSize: integer = 64 * 3;
	terrainResolution: integer = 128;
	flySpeed: single = 1.3;
	visiblity: integer = 4;

type
	TTilingTerrain = class (TTerrain)
		public
			neighbor: TTilingTerrain;
		protected
			function GetHeightForVertex (localX, localY, x, y: integer): TNoiseFloat; override;
	end;

function TTilingTerrain.GetHeightForVertex (localX, localY, x, y: integer): TNoiseFloat; 
begin		
	if (localY = 0) and (neighbor <> nil) then
		result := neighbor.GetHeightAtPoint(localX, localY + neighbor.GetWidth - 1)
	else
		begin
			result := noise.GetNoise(x, y, GetWidth, GetHeight, 6, 3);
			result := Power(result, 9) * 60;
		end;
end;

procedure DrawCanvas;
var
	terrainCoord: TVec3;
	startIndex, endIndex: integer;
	i: integer;
	map: TTilingTerrain;
	neighbor: TTilingTerrain = nil;
begin
	gl.clear(gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT);

	// apply camera to view transform
	viewTransform := TMat4.Identity;
	viewTransform := viewTransform.Multiply(TMat4.Translate(camera.x, camera.y, camera.z));
	shader.SetUniformMat4('viewTransform', viewTransform);

	// move light with camera
	lightPosition.z += flySpeed;
	shader.SetUniformVec3('lightPosition', lightPosition);

	// animate camera
	camera.z -= flySpeed;
	camera.y := -(terrainSize/4) + Sin(camera.z / terrainSize) * 14;
	camera.x := -(terrainSize/2) + Cos(camera.z / terrainSize) * 20;
	terrainCoord := Divide(camera, terrainSize);

	endIndex := Trunc(Abs(terrainCoord.z));
	startIndex := endIndex - visiblity;
	if startIndex < 0 then
		startIndex := 0;

	// https://gamedev.stackexchange.com/questions/23625/how-do-you-generate-tileable-perlin-noise

	//debugConsole.innerHTML := IntToStr(startIndex)+'/'+IntToStr(endIndex) + VecStr(terrainCoord);

	for i := startIndex to endIndex do
		begin
			if (maps.length = 0) or ((maps.length = i) and (maps[i] = nil)) then
				begin
					map := TTilingTerrain.Create(gl, terrainNoise, terrainSize, terrainResolution, V2(0, terrainSize * i));
					if (i - 1) >= 0 then
						map.neighbor := TTilingTerrain(maps[i - 1]);
					map.Generate;

					// TODO: take the edge and set the heights to same size as the neighbor
					// we need to do this pre-vertex generation so we need a callback
					// or interface (which doesn't exist yet)

					maps.push(map);

					// NOTE: does this free memory in JS?
					if startIndex - 1 >= 0 then
						maps[startIndex - 1] := nil;
				end;

			map := TTilingTerrain(maps[i]);
			modelTransform := TMat4.Identity;
			modelTransform := modelTransform.Multiply(TMat4.Translate(0, 0, terrainSize * i));
			shader.SetUniformMat4('modelTransform', modelTransform);
			map.Draw;
		end;

	//if abs(terrainCoord.z) > 10 then
	//	begin
	//		writeln('cancel animation');
	//		window.cancelAnimationFrame(canvasAnimationHandler);
	//		canvasAnimationHandler := 0;
	//	end;
end;

procedure AnimateCanvas(time: TDOMHighResTimeStamp);
begin
	DrawCanvas;

	if canvasAnimationHandler <> 0 then
		canvasAnimationHandler := window.requestAnimationFrame(@AnimateCanvas);
end;

procedure StartAnimatingCanvas;
begin
	canvasAnimationHandler := window.requestAnimationFrame(@AnimateCanvas);
end;

var
  canvas: TJSHTMLCanvasElement;
  i: integer;
  stride: integer;
  offset: integer;
  vertexShaderSource: string;
  fragmentShaderSource: string;
  buffer: TJSWebGLBuffer;
  element: TJSElement;
  texture: TJSWebGLTexture;
begin

	// add debug status
	debugConsole := document.getElementById('debug-console');

	// make webgl context
  canvas := TJSHTMLCanvasElement(document.createElement('canvas'));
  canvas.width := 800;
  canvas.height := 600;
	document.body.appendChild(canvas);

	gl := TJSWebGLRenderingContext(canvas.getContext('webgl'));
	if gl = nil then
		begin
			writeln('failed to load webgl!');
			exit;
		end;

	// create shaders from source in html
	// TODO: move these to .glsl files so error messages make more sense
	// and give valid line numbers
	vertexShaderSource := document.getElementById('vertex.glsl').textContent;
	fragmentShaderSource := document.getElementById('fragment.glsl').textContent;

	shader := TShader.Create(gl, vertexShaderSource, fragmentShaderSource);
	shader.Compile;
  shader.BindAttribLocation(0, 'in_position');
  shader.BindAttribLocation(1, 'in_texCoord');
  shader.BindAttribLocation(2, 'in_normal');
	shader.Link;
	shader.Use;

	// prepare context
	gl.clearColor(0.9, 0.9, 0.9, 1);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// NOTE: we don't need this in WebGL
	//gl.enable(gl.TEXTURE_2D);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.Enable(gl.CULL_FACE);
	gl.CullFace(gl.BACK);

	projTransform := TMat4.Perspective(60.0, canvas.width / canvas.height, 0.1, 2000);

	shader.SetUniformMat4('projTransform', projTransform);

	viewTransform := TMat4.Identity;
	//viewTransform := viewTransform.Multiply(TMat4.Translate(-10, -3, -20));
	shader.SetUniformMat4('viewTransform', viewTransform);

	// NOTE: webgl glsl doesn't have the inverse function
	// so we need to do this here
	shader.SetUniformMat4('inverseViewTransform', viewTransform.Inverse);

	// lighting
	lightPosition := V3(0, terrainSize / 2, -(terrainSize/2));
	shader.SetUniformVec3('lightPosition', lightPosition);
	shader.SetUniformVec3('lightColor', V3(1, 1, 1));

	// model material
	shader.SetUniformFloat('shineDamper', 1000);
	shader.SetUniformFloat('reflectivity', 1);

	gl.clear(gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT);

	modelTransform := TMat4.Identity;
	shader.SetUniformMat4('modelTransform', modelTransform);

	camera.x := -(terrainSize/2);
	camera.y := -(terrainSize/4);
	camera.z := -(terrainSize/2);

	// load terrain texture from image tag
	element := document.getElementById('terrain-texture');

	texture := gl.createTexture;
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, TJSTexImageSource(element));

	terrainNoise := TNoise.Create(RandomNoiseSeed(1));
	maps := TJSArray.new;

	//map.Draw;
	StartAnimatingCanvas;
end.